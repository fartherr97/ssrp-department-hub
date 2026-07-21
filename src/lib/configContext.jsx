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
import { safeMediaUrl } from "./urls.js";
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
  // Redo stack: configs popped by an undo, so an undo can be reversed. Cleared
  // as soon as a fresh edit happens (that edit branches the history).
  const redoRef = useRef([]);
  const [redoDepth, setRedoDepth] = useState(0);

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

  // Drive the browser tab from the department's branding: the title from its
  // name, and the favicon from the logo set in the Builder Portal (falling back
  // to the default icon when no logo is set). Updates live as branding changes.
  const brandName = config?.branding?.name || config?.branding?.shortName;
  const brandLogo = config?.branding?.logoUrl;
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (brandName) document.title = brandName;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const url = safeMediaUrl(brandLogo);
    if (url) {
      link.setAttribute("href", url);
      link.removeAttribute("type"); // let the browser detect png/jpg/data URI
    } else {
      link.setAttribute("href", "/favicon.svg");
      link.setAttribute("type", "image/svg+xml");
    }
  }, [brandName, brandLogo]);

  const persist = useCallback((next, opts = {}) => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    // Restores (whole-config replace) save immediately and via the manager-only
    // restore endpoint, which bypasses the per-section edit checks; ordinary
    // edits debounce so rapid changes (sliders, typing) don't thrash the API.
    saveTimer.current = setTimeout(() => {
      // Record who changed what (net change since the last save), then persist.
      audit.recordChange(lastSavedRef.current, next);
      lastSavedRef.current = next;
      api
        .saveConfig(next, opts)
        .catch((e) => console.error("[config] save failed:", e?.message || e))
        .finally(() => setSaving(false));
    }, opts.restore ? 0 : 300);
  }, []);

  // Push an undo snapshot of `prev`. Edits made within HISTORY_STEP_GAP of each
  // other count as a single step, so undo reverts a whole burst of typing, not
  // one keystroke. Undo always works in-memory for the session; we only PERSIST
  // history to localStorage for small configs — for a large roster, serializing
  // ~10 full copies on every edit stalls the main thread (which can make a modal
  // feel stuck on save), so we keep it in-memory only.
  const trackChange = useCallback((prev) => {
    if (!prev) return;
    // A fresh edit invalidates any pending redo (we've branched off it).
    if (redoRef.current.length) {
      redoRef.current = [];
      setRedoDepth(0);
    }
    const now = Date.now();
    const sameBurst = now - lastSnapAt.current < HISTORY_STEP_GAP;
    lastSnapAt.current = now;
    if (sameBurst && historyRef.current.length) return;
    historyRef.current = [...historyRef.current, prev].slice(-HISTORY_LIMIT);
    setUndoDepth(historyRef.current.length);
    if (isLargeConfig(prev)) return; // in-memory only for big rosters
    writeJSON(HISTORY_KEY, historyRef.current);
  }, []);

  // Revert to the most recent snapshot, stashing the current state so the undo
  // can be reversed with redo(). Returns true if something was undone.
  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return false;
    setUndoDepth(historyRef.current.length);
    writeJSON(HISTORY_KEY, historyRef.current);
    lastSnapAt.current = 0; // the next edit starts a fresh undo step
    setConfigState((current) => {
      redoRef.current = [...redoRef.current, current].slice(-HISTORY_LIMIT);
      setRedoDepth(redoRef.current.length);
      return prev;
    });
    persist(prev, { restore: true });
    return true;
  }, [persist]);

  // Re-apply the most recently undone state. The current state goes back onto
  // the undo stack, so undo/redo can be toggled freely. Returns true if it did.
  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (next === undefined) return false;
    setRedoDepth(redoRef.current.length);
    lastSnapAt.current = 0;
    setConfigState((current) => {
      historyRef.current = [...historyRef.current, current].slice(-HISTORY_LIMIT);
      setUndoDepth(historyRef.current.length);
      if (!isLargeConfig(current)) writeJSON(HISTORY_KEY, historyRef.current);
      return next;
    });
    persist(next, { restore: true });
    return true;
  }, [persist]);

  // Replace the whole config (backup restore, version-history restore). Saved
  // via the restore endpoint so re-adding groups/capabilities isn't blocked by
  // the granular edit checks.
  const replaceConfig = useCallback(
    (next) => {
      setConfigState((prev) => {
        trackChange(prev);
        return next;
      });
      persist(next, { restore: true });
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
        redo,
        canRedo: redoDepth > 0,
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
