/*
 * Config endpoints — the heart of the contract (src/lib/api.js getConfig/saveConfig).
 *
 *   GET  /api/config  → the department's config object (seeded from the
 *                       boilerplate default on first ever read)
 *   PUT  /api/config  → replace it (requires manage-site)
 *
 * Reads are open to any signed-in member (the front-end needs the config to
 * render). Writes require the manageSite capability, re-checked server-side.
 */
import { Router } from "express";
import { loadConfig, saveConfig } from "../db.js";
import { requireAuth, canManageSite } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import { cloneDefaultConfig } from "../../src/config/defaultConfig.js";
import {
  canManageAccess,
  canEditAnyRoster,
  hasCapability,
  canManageCalendar,
  canWriteLogs,
} from "../../src/lib/permissions.js";
import { publicConfig, redactSensitive, mergeRedactedBack } from "../configView.js";

const MAX_CONFIG_BYTES = 4 * 1024 * 1024; // 4 MB ceiling on a single config doc

// Get the live config for a department, seeding defaults the first time it loads.
export async function currentConfig(departmentId) {
  let config = await loadConfig(departmentId);
  if (!config) {
    config = cloneDefaultConfig();
    await saveConfig(departmentId, config);
  }
  return config;
}

// Convenience for middleware/handlers that have the request in hand.
const configForReq = (req) => currentConfig(req.departmentId || resolveDepartmentId(req));

// Any write capability lets a user save the (single-document) config; what they
// may actually change is then narrowed by authorizeConfigChange below.
function canWriteConfig(user, config) {
  return (
    canManageSite(user, config) ||
    canManageAccess(user, config) ||
    canEditAnyRoster(user, config) ||
    hasCapability(user, config, "editRosterLimited") ||
    hasCapability(user, config, "manageCalendar") ||
    hasCapability(user, config, "manageLogs")
  );
}

/*
 * The config is one document, so a save from a roster/calendar/log editor still
 * PUTs the whole thing. Block the escalation-sensitive sections unless the user
 * holds the matching capability:
 *   - groups / auth         → manage-access (or manage-site)
 *   - branding / nav / pages structure → manage-site
 * Roster, calendar, and log content (roster.*, page data) are left to the
 * respective editors. NOTE for the backend hardening pass: finer-grained
 * endpoints (e.g. /api/roster) would let the server validate exactly which
 * members a limited editor touched; today it trusts staff for in-scope edits.
 */
function changed(a, b, key) {
  return JSON.stringify(a?.[key]) !== JSON.stringify(b?.[key]);
}

// Ids of the roster subdivisions whose member lists changed between two configs.
function changedSubdivisionIds(current, incoming) {
  const cur = new Map((current?.roster?.subdivisions || []).map((s) => [s.id, s]));
  const inc = new Map((incoming?.roster?.subdivisions || []).map((s) => [s.id, s]));
  const ids = new Set();
  for (const [id, s] of inc) {
    if (JSON.stringify(cur.get(id)) !== JSON.stringify(s)) ids.add(id);
  }
  for (const id of cur.keys()) if (!inc.has(id)) ids.add(id);
  return ids;
}

// Did any page of one of these types change? Used to route calendar/log content
// edits to the matching capability instead of trusting any writer.
function changedPageTypes(current, incoming) {
  const cur = new Map((current?.pages || []).map((p) => [p.id, p]));
  const inc = new Map((incoming?.pages || []).map((p) => [p.id, p]));
  const types = new Set();
  for (const [id, p] of inc) {
    if (JSON.stringify(cur.get(id)) !== JSON.stringify(p)) types.add(p.type);
  }
  for (const [id, p] of cur) if (!inc.has(id)) types.add(p.type);
  return types;
}

function authorizeConfigChange(user, current, incoming) {
  // Groups / auth (role mappings, capability grants) → manage-access or above.
  if (changed(current, incoming, "groups") || changed(current, incoming, "auth")) {
    if (!canManageAccess(user, current) && !canManageSite(user, current)) {
      return "groups or access settings";
    }
  }
  // Branding / navigation / page structure → manage-site only.
  if (
    !canManageSite(user, current) &&
    (changed(current, incoming, "branding") ||
      changed(current, incoming, "navGroups") ||
      changed(current, incoming, "dropdownGroups"))
  ) {
    return "site branding or navigation";
  }
  // Roster edits: full roster editors are fine; a limited (junior-ranks) editor
  // may only touch the MAIN subdivision, and only within their rank ceiling —
  // that per-member ceiling is enforced by canEditMember on the granular path,
  // but here (whole-doc PUT) we at least confine them to the main roster. Anyone
  // with no roster capability at all can't change roster data.
  if (changed(current, incoming, "roster")) {
    const full = canEditAnyRoster(user, current) || canManageSite(user, current);
    if (!full) {
      if (!hasCapability(user, current, "editRosterLimited")) return "the roster";
      const mainId = (current?.roster?.subdivisions || []).find((s) => s.main)?.id;
      for (const id of changedSubdivisionIds(current, incoming)) {
        if (id !== mainId) return "subdivision rosters";
      }
    }
  }
  // Page content: calendar pages need manage-calendar, log pages need manage-logs
  // (manage-site covers both). Other page types are covered by the structure and
  // section rules above / left to general writers.
  if (changed(current, incoming, "pages") && !canManageSite(user, current)) {
    const types = changedPageTypes(current, incoming);
    if (types.has("calendar") && !canManageCalendar(user, current)) {
      return "calendar events";
    }
    const logTypes = ["adminlog", "fto", "interview", "booth"];
    if (logTypes.some((t) => types.has(t)) && !canWriteLogs(user, current)) {
      return "administrative logs";
    }
  }
  return null;
}

export function configRouter() {
  const router = Router();

  // The front-end needs a config to render the login screen (branding, theme,
  // dev-login group picker) before anyone signs in, so GET is reachable while
  // unauthenticated — but it must NOT hand the full document (member Discord ids,
  // role mappings, webhook credentials) to the public. Shape the response to the
  // caller: public subset for guests, secrets redacted for signed-in
  // non-managers, full document for site managers. The front-end re-fetches on
  // auth change (configContext reload), so a user always upgrades to their view.
  router.get("/config", async (req, res, next) => {
    try {
      const config = await configForReq(req);
      if (!req.user) return res.json({ ok: true, data: publicConfig(config) });
      if (canManageSite(req.user, config)) return res.json({ ok: true, data: config });
      return res.json({ ok: true, data: redactSensitive(config) });
    } catch (err) {
      next(err);
    }
  });

  router.put("/config", requireAuth, async (req, res, next) => {
    try {
      const incoming = req.body;
      // Validate shape + size before trusting the payload (README checklist).
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return res.status(400).json({ ok: false, error: "Config must be an object" });
      }
      if (Buffer.byteLength(JSON.stringify(incoming)) > MAX_CONFIG_BYTES) {
        return res.status(413).json({ ok: false, error: "Config too large" });
      }
      const current = await configForReq(req);
      if (!canWriteConfig(req.user, current)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
      }
      // Non-managers received the config with webhook URLs redacted; restore the
      // real secrets from the stored config before doing anything else, so a
      // routine save can't blank them AND so the redaction sentinel doesn't look
      // like a real change to authorizeConfigChange below.
      const merged = canManageSite(req.user, current)
        ? incoming
        : mergeRedactedBack(incoming, current);
      const blocked = authorizeConfigChange(req.user, current, merged);
      if (blocked) {
        return res
          .status(403)
          .json({ ok: false, error: `Not allowed to change ${blocked}` });
      }
      const saved = await saveConfig(req.departmentId || resolveDepartmentId(req), merged);
      // Echo back the same view the caller is allowed to see (don't leak secrets
      // a non-manager didn't have a moment ago).
      res.json({
        ok: true,
        data: canManageSite(req.user, saved) ? saved : redactSensitive(saved),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export { canManageSite };
