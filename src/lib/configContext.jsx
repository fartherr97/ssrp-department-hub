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
import { applyTheme } from "./theme.js";
import { readJSON, writeJSON } from "./storage.js";
import { cloneDefaultConfig } from "../config/defaultConfig.js";

const ConfigContext = createContext(null);

// Undo history: how many snapshots to keep, and how long a pause (ms) starts a
// new undo step. Rapid edits (typing, color drags) collapse into one step.
const HISTORY_LIMIT = 10;
const HISTORY_STEP_GAP = 4000;
const HISTORY_KEY = "configHistory";

// Rough gauge of "big config" (skip heavy localStorage snapshotting). Cheap:
// counts roster members instead of serializing the whole config.
function isLargeConfig(config) {
  let n = 0;
  for (const s of config?.roster?.subdivisions || [])
    for (const c of s.categories || []) n += (c.members || []).length;
  return n > 150;
}

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

  // Fetch (or re-fetch) the config from the data layer and load it into state.
  // Called once on mount, and again on every auth change: the backend tailors
  // GET /api/config to the caller (a guest gets a public subset with no member
  // lists / secrets; a signed-in user gets their full view), so we must reload
  // after login/logout to swap between those views.
  const reload = useCallback(() => {
    return api
      .getConfig()
      .catch((err) => {
        // Never hang on "LOADING…" if the backend hiccups — fall back to the
        // default config so the app still renders (and login still works).
        console.error("Failed to load config, using defaults:", err);
        return cloneDefaultConfig();
      })
      .then((loaded) => {
        setConfigState(loaded);
        lastSavedRef.current = loaded;
        applyTheme(loaded?.branding?.colors);
        setReady(true);
        return loaded;
      });
  }, []);

  // Initial load.
  useEffect(() => {
    historyRef.current = readJSON(HISTORY_KEY, []);
    setUndoDepth(historyRef.current.length);
    reload();
  }, [reload]);

  // Keep the theme in sync whenever colors change.
  useEffect(() => {
    if (config?.branding?.colors) applyTheme(config.branding.colors);
  }, [config?.branding?.colors]);

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
  // one keystroke. Undo always works in-memory for the session; we only PERSIST
  // history to localStorage for small configs — for a large roster, serializing
  // ~10 full copies on every edit stalls the main thread (which can make a modal
  // feel stuck on save), so we keep it in-memory only.
  const trackChange = useCallback((prev) => {
    if (!prev) return;
    const now = Date.now();
    const sameBurst = now - lastSnapAt.current < HISTORY_STEP_GAP;
    lastSnapAt.current = now;
    if (sameBurst && historyRef.current.length) return;
    historyRef.current = [...historyRef.current, prev].slice(-HISTORY_LIMIT);
    setUndoDepth(historyRef.current.length);
    if (isLargeConfig(prev)) return; // in-memory only for big rosters
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

  return (
    <ConfigContext.Provider
      value={{
        config,
        ready,
        saving,
        mutate,
        replaceConfig,
        reload,
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
