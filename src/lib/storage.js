/*
 * Tiny localStorage wrapper used by the front-end-only mock backend.
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

export function removeKey(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
