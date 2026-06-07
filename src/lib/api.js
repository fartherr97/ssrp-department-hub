/*
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA LAYER — the single swap-point between the front-end and the backend.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Today every call is served by a localStorage-backed MOCK so the whole hub —
 * Builder Portal, roster editing, dev login — works with no server.
 *
 * When Steve builds the backend (Express + passport-discord + MariaDB), flip
 * USE_BACKEND to true (or set VITE_USE_BACKEND=true) and implement the REST
 * contract documented in README.md. The function signatures below ARE the
 * contract — the rest of the app only ever imports from this file.
 */

import { cloneDefaultConfig, CONFIG_VERSION } from "../config/defaultConfig.js";
import { readJSON, writeJSON, removeKey } from "./storage.js";

const USE_BACKEND =
  import.meta.env?.VITE_USE_BACKEND === "true" || false;

const CONFIG_KEY = "config";
const SESSION_KEY = "session";

// ─── Real backend transport (used when USE_BACKEND) ──────────────────────────

async function http(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data ?? json;
}

// ─── Config migration ────────────────────────────────────────────────────────
// Deep-merge a saved config over the current defaults so new fields added in a
// later version of the boilerplate appear without wiping a department's data.

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isObject(base)) return override ?? base;
  const out = { ...base };
  for (const key of Object.keys(override || {})) {
    out[key] = isObject(base[key]) && isObject(override[key])
      ? deepMerge(base[key], override[key])
      : override[key];
  }
  return out;
}

function migrateConfig(saved) {
  const defaults = cloneDefaultConfig();
  if (!saved) return defaults;
  // Arrays (pages, ranks, groups…) are owned by the saved config once it exists;
  // scalars/objects fall back to defaults for any newly introduced field.
  const merged = deepMerge(defaults, saved);
  merged.version = CONFIG_VERSION;
  return merged;
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

export async function getConfig() {
  if (USE_BACKEND) return http("/config");
  return migrateConfig(readJSON(CONFIG_KEY, null));
}

export async function saveConfig(config) {
  if (USE_BACKEND) {
    return http("/config", { method: "PUT", body: JSON.stringify(config) });
  }
  const next = { ...config, version: CONFIG_VERSION };
  writeJSON(CONFIG_KEY, next);
  return next;
}

export async function resetConfig() {
  if (USE_BACKEND) return http("/config/reset", { method: "POST" });
  removeKey(CONFIG_KEY);
  return cloneDefaultConfig();
}

// ─── AUTH / SESSION ──────────────────────────────────────────────────────────

// Returns the current user, or null if signed out.
export async function getSession() {
  if (USE_BACKEND) {
    try {
      return await http("/../auth/me"); // GET /auth/me
    } catch {
      return null;
    }
  }
  return readJSON(SESSION_KEY, null);
}

// Front-end-only dev login: impersonate a permission group to preview the hub.
export async function devLogin(group) {
  const user = {
    id: "dev-" + group,
    username: `Dev ${group}`,
    avatarUrl: "",
    group,
    isAdmin: group === "admin",
    isDev: true,
  };
  writeJSON(SESSION_KEY, user);
  return user;
}

export async function logout() {
  if (USE_BACKEND) {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    return null;
  }
  removeKey(SESSION_KEY);
  return null;
}
