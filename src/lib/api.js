/*
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA LAYER — the single point the front-end talks to the backend through.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every call hits the Express + MariaDB API in server/ (Discord auth, config,
 * roster, audit, versions, duty hours). The function signatures below ARE the
 * REST contract; the rest of the app only ever imports from this file, so the
 * transport stays in one place.
 */

// ─── Transport ───────────────────────────────────────────────────────────────

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
  // Our envelope is { ok, data }. Return data even when it's null/false — a
  // logged-out /auth/me legitimately returns data:null, and `json.data ?? json`
  // would wrongly hand back the whole truthy envelope (making the app think a
  // guest is signed in). Only fall back to the raw body for non-enveloped replies.
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Ensure department-independent "system" pages exist in the loaded config. The
// backend returns a stored config verbatim, so a newly added page type like Help
// would never appear for existing departments; inject it in memory on every load
// instead. Idempotent, and not persisted unless the config is later saved.
function ensureSystemPages(config) {
  if (!config || !Array.isArray(config.pages)) return config;
  if (config.pages.some((p) => p.type === "help")) return config;
  const id = config.pages.some((p) => p.id === "help") ? "sys-help" : "help";
  const helpPage = { id, label: "Help", navGroup: "Administration", icon: "HelpCircle", type: "help", config: {} };
  const navGroups =
    !Array.isArray(config.navGroups) || config.navGroups.includes("Administration")
      ? config.navGroups
      : [...config.navGroups, "Administration"];
  return { ...config, pages: [...config.pages, helpPage], navGroups: navGroups || config.navGroups };
}

// Entry types retired from the default Admin Log (strikes/DAs come from the SSRP
// Records portal, not here). Strip them from any saved admin-log book so old
// pages stop offering them; historical entries already logged are untouched.
const REMOVED_LOG_TYPES = new Set(["Verbal DA / Coaching", "Non-Verbal DA", "Strike", "Other"]);
function stripRemovedLogTypes(config) {
  if (!config || !Array.isArray(config.pages)) return config;
  const pages = config.pages.map((p) => {
    if (p.type !== "adminlog" || !Array.isArray(p.config?.books)) return p;
    let touched = false;
    const books = p.config.books.map((b) => {
      if (!Array.isArray(b.types) || !b.types.some((t) => REMOVED_LOG_TYPES.has(t))) return b;
      touched = true;
      return { ...b, types: b.types.filter((t) => !REMOVED_LOG_TYPES.has(t)) };
    });
    return touched ? { ...p, config: { ...p.config, books } } : p;
  });
  return { ...config, pages };
}

export async function getConfig() {
  const raw = await http("/config");
  return stripRemovedLogTypes(ensureSystemPages(raw));
}

// opts.restore: a wholesale replace (backup / version restore). It goes to the
// manager-only restore endpoint that bypasses the per-section edit checks, so
// re-adding groups and capabilities isn't rejected as "a permission you don't
// have" (that guard is for targeted edits by limited editors, not restores).
export async function saveConfig(config, opts = {}) {
  const path = opts.restore ? "/config/restore" : "/config";
  return http(path, { method: "PUT", body: JSON.stringify(config) });
}

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────
// Records of who changed what, newest first. The backend stores these forever
// (no delete endpoint) and exposes GET/POST /api/audit.

export async function getAuditLog() {
  return http("/audit");
}

export async function appendAuditLog(entry) {
  return http("/audit", { method: "POST", body: JSON.stringify(entry) });
}

// ─── ADMIN LOG → RECORDS PORTAL ──────────────────────────────────────────────
// Sends one admin-log entry to the backend, which stamps who logged it and the
// department server-side and forwards it to the Records portal (attached to the
// subject member via subject.discordId). Only send subject + book + type + date
// + values; the server never trusts a client-supplied actor.
export async function submitLog(entry) {
  return http("/logs", { method: "POST", body: JSON.stringify(entry) });
}

// ─── VERSION HISTORY ─────────────────────────────────────────────────────────
// Google-Docs-style snapshots: each save records the full config so any past
// version can be restored. The list is metadata-only; a full snapshot is fetched
// per-version, on restore.

export async function getVersions() {
  return http("/versions");
}

// Fetch one version's full config snapshot. Returns the config, or null.
export async function getVersion(id) {
  const r = await http(`/versions/${encodeURIComponent(id)}`);
  return r?.config ?? null;
}

export async function pushVersion(version) {
  return http("/versions", { method: "POST", body: JSON.stringify(version) });
}

// ─── DUTY HOURS ──────────────────────────────────────────────────────────────
// On-duty hours come from an external Duty Hub; the backend fetches/caches them
// and serves GET /api/hours. Shape:
//   { updatedAt, source, members: [{ discordId, name, weekHours, monthHours }] }

export async function getDutyHours() {
  try {
    return await http("/hours");
  } catch {
    return { updatedAt: null, source: "backend", members: [] };
  }
}

// Resolve a Discord ID to a guild display name via the backend (needs a bot
// token server-side). Returns { discordId, displayName, ... } or null; callers
// fall back to a local directory when this yields nothing.
export async function lookupDiscordMember(discordId) {
  try {
    return await http(`/discord/member/${encodeURIComponent(discordId)}`);
  } catch {
    return null;
  }
}

// ─── AUTH / SESSION ──────────────────────────────────────────────────────────

// Returns the current user, or null if signed out.
export async function getSession() {
  try {
    return await http("/../auth/me"); // GET /auth/me
  } catch {
    return null;
  }
}

export async function logout() {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
  return null;
}
