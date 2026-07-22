/*
 * Tiny localStorage wrapper for client-only persistence (e.g. the Builder
 * Portal's undo/redo history — see configContext.jsx). All app data lives on the
 * backend; this is just for browser-local UI state.
 * Safe against quota errors, JSON parse failures, and SSR (no window).
 */

const PREFIX = "dept-hub:";

export function readJSON(key, fallback = null) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// Like writeJSON but reports whether the write succeeded, so callers can shed
// data (e.g. drop the oldest snapshots) and retry until it fits the quota.
export function tryWriteJSON(key, value) {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
