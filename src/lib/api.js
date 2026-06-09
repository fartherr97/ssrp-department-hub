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
const AUDIT_KEY = "audit";
const AUDIT_LIMIT = 500;

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

  // v0 → v1: roster.ranks (a single flat roster) became roster.subdivisions
  // (multiple tabbed rosters). Wrap any legacy ranks into a default subdivision.
  if (merged.roster && Array.isArray(merged.roster.ranks)) {
    if (!Array.isArray(saved?.roster?.subdivisions)) {
      merged.roster.subdivisions = [
        { id: "sub-main", name: "Department", ranks: merged.roster.ranks },
      ];
    }
    delete merged.roster.ranks;
  }
  if (!Array.isArray(merged.roster?.subdivisions) || merged.roster.subdivisions.length === 0) {
    merged.roster = merged.roster || {};
    merged.roster.subdivisions = cloneDefaultConfig().roster.subdivisions;
  }

  // v1 → v2: a subdivision's `ranks` array used to hold the colored grouping
  // bands. Those bands are now `categories`; `ranks` becomes a list of rank
  // titles (empty to start) and each member gains a `rank`. Data is preserved.
  if ((saved.version ?? 0) < 2 && Array.isArray(merged.roster?.subdivisions)) {
    merged.roster.subdivisions = merged.roster.subdivisions.map((sub) => {
      if (Array.isArray(sub.categories)) return sub; // already migrated
      const bands = Array.isArray(sub.ranks) ? sub.ranks : [];
      return {
        ...sub,
        ranks: [],
        categories: bands.map((band) => ({
          ...band,
          members: (band.members || []).map((m) => ({ rank: "", ...m })),
        })),
      };
    });
  }

  // Backfill group capability flags + members for configs predating them, so
  // existing rosters keep working (command-and-up could edit; admin = full).
  if (Array.isArray(merged.groups)) {
    const commandLevel = merged.groups.find((g) => g.id === "command")?.level ?? 3;
    merged.groups = merged.groups.map((g) => ({
      members: [],
      isAdmin: g.id === "admin",
      canEditRoster: g.id === "admin" || (g.level ?? 0) >= commandLevel,
      ...g,
    }));
  }

  // Ensure the Audit Log page exists for configs created before it was added.
  if (Array.isArray(merged.pages) && !merged.pages.some((p) => p.type === "audit")) {
    const auditPage = cloneDefaultConfig().pages.find((p) => p.type === "audit");
    if (auditPage) merged.pages = [...merged.pages, auditPage];
  }

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

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────
// Records of who changed what, newest first. Backend would store these in a
// table and expose GET/POST /api/audit; the mock keeps the last AUDIT_LIMIT.

export async function getAuditLog() {
  if (USE_BACKEND) return http("/audit");
  return readJSON(AUDIT_KEY, []);
}

export async function appendAuditLog(entry) {
  if (USE_BACKEND) {
    return http("/audit", { method: "POST", body: JSON.stringify(entry) });
  }
  const log = readJSON(AUDIT_KEY, []);
  const next = [entry, ...log].slice(0, AUDIT_LIMIT);
  writeJSON(AUDIT_KEY, next);
  return entry;
}

export async function clearAuditLog() {
  if (USE_BACKEND) return http("/audit", { method: "DELETE" });
  removeKey(AUDIT_KEY);
  return [];
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
