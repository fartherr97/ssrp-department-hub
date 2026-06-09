import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as api from "./api.js";
import * as audit from "./audit.js";
import { applyTheme, applyFont } from "./theme.js";
import { readJSON, writeJSON } from "./storage.js";

const ConfigContext = createContext(null);

// Undo history: how many snapshots to keep, and how long a pause (ms) starts a
// new undo step. Rapid edits (typing, color drags) collapse into one step.
const HISTORY_LIMIT = 10;
const HISTORY_STEP_GAP = 4000;
const HISTORY_KEY = "configHistory";

export function ConfigProvider({ children }) {
  const [config, setConfigState] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  // The last persisted config, so audit can diff net changes per save.
  const lastSavedRef = useRef(null);
  // Undo stack (oldest → newest snapshot taken *before* each change).
  const historyRef = useRef([]);
  const lastSnapAt = useRef(0);
  const [undoDepth, setUndoDepth] = useState(0);

  // Initial load.
  useEffect(() => {
    let alive = true;
    api.getConfig().then((loaded) => {
      if (!alive) return;
      setConfigState(loaded);
      lastSavedRef.current = loaded;
      historyRef.current = readJSON(HISTORY_KEY, []);
      setUndoDepth(historyRef.current.length);
      applyTheme(loaded?.branding?.colors);
      applyFont(loaded?.branding?.font);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the theme in sync whenever colors change.
  useEffect(() => {
    if (config?.branding?.colors) applyTheme(config.branding.colors);
  }, [config?.branding?.colors]);

  useEffect(() => {
    if (config) applyFont(config.branding?.font);
  }, [config?.branding?.font]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((next) => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    // Debounce so rapid edits (sliders, typing) don't thrash storage/the API.
    saveTimer.current = setTimeout(() => {
      // Record who changed what (net change since the last save), then persist.
      audit.recordChange(lastSavedRef.current, next);
      lastSavedRef.current = next;
      api.saveConfig(next).finally(() => setSaving(false));
    }, 300);
  }, []);

  // Push an undo snapshot of `prev`. Edits made within HISTORY_STEP_GAP of each
  // other count as a single step, so undo reverts a whole burst of typing, not
  // one keystroke. writeJSON is quota-safe: if snapshots don't fit (e.g. large
  // uploaded images), history simply stays in-memory for the session.
  const trackChange = useCallback((prev) => {
    if (!prev) return;
    const now = Date.now();
    const sameBurst = now - lastSnapAt.current < HISTORY_STEP_GAP;
    lastSnapAt.current = now;
    if (sameBurst && historyRef.current.length) return;
    historyRef.current = [...historyRef.current, prev].slice(-HISTORY_LIMIT);
    setUndoDepth(historyRef.current.length);
    writeJSON(HISTORY_KEY, historyRef.current);
  }, []);

  // Revert to the most recent snapshot. Returns true if something was undone.
  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return false;
    setUndoDepth(historyRef.current.length);
    writeJSON(HISTORY_KEY, historyRef.current);
    lastSnapAt.current = 0; // the next edit starts a fresh undo step
    setConfigState(prev);
    persist(prev);
    return true;
  }, [persist]);

  // Replace the whole config.
  const replaceConfig = useCallback(
    (next) => {
      setConfigState((prev) => {
        trackChange(prev);
        return next;
      });
      persist(next);
    },
    [persist, trackChange]
  );

  // Functional update: mutate(prev => next). Most edits go through here.
  const mutate = useCallback(
    (updater) => {
      setConfigState((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        if (next !== prev) trackChange(prev);
        persist(next);
        return next;
      });
    },
    [persist, trackChange]
  );

  const resetConfig = useCallback(async () => {
    const fresh = await api.resetConfig();
    trackChange(config);
    setConfigState(fresh);
    lastSavedRef.current = fresh;
    applyTheme(fresh?.branding?.colors);
    applyFont(fresh?.branding?.font);
    audit.logEvent("config", "Reset the configuration to defaults");
    return fresh;
  }, [config, trackChange]);

  return (
    <ConfigContext.Provider
      value={{
        config,
        ready,
        saving,
        mutate,
        replaceConfig,
        resetConfig,
        undo,
        canUndo: undoDepth > 0,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a ConfigProvider");
  return ctx;
}
