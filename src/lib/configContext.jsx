import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as api from "./api.js";
import { applyTheme } from "./theme.js";

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfigState] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Initial load.
  useEffect(() => {
    let alive = true;
    api.getConfig().then((loaded) => {
      if (!alive) return;
      setConfigState(loaded);
      applyTheme(loaded?.branding?.colors);
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

  const persist = useCallback((next) => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    // Debounce so rapid edits (sliders, typing) don't thrash storage/the API.
    saveTimer.current = setTimeout(() => {
      api.saveConfig(next).finally(() => setSaving(false));
    }, 300);
  }, []);

  // Replace the whole config.
  const replaceConfig = useCallback(
    (next) => {
      setConfigState(next);
      persist(next);
    },
    [persist]
  );

  // Functional update: mutate(prev => next). Most edits go through here.
  const mutate = useCallback(
    (updater) => {
      setConfigState((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const resetConfig = useCallback(async () => {
    const fresh = await api.resetConfig();
    setConfigState(fresh);
    applyTheme(fresh?.branding?.colors);
    return fresh;
  }, []);

  return (
    <ConfigContext.Provider
      value={{ config, ready, saving, mutate, replaceConfig, resetConfig }}
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
