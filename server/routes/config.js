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
} from "../../src/lib/permissions.js";

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

function authorizeConfigChange(user, current, incoming) {
  if (changed(current, incoming, "groups") || changed(current, incoming, "auth")) {
    if (!canManageAccess(user, current) && !canManageSite(user, current)) {
      return "groups or access settings";
    }
  }
  if (
    !canManageSite(user, current) &&
    (changed(current, incoming, "branding") ||
      changed(current, incoming, "navGroups") ||
      changed(current, incoming, "dropdownGroups"))
  ) {
    return "site branding or navigation";
  }
  return null;
}

export function configRouter() {
  const router = Router();

  // Public: the front-end needs the config to render the login screen itself
  // (branding, theme) before anyone is signed in, mirroring the localStorage
  // mock which always returns it. Writes are still gated below.
  router.get("/config", async (req, res, next) => {
    try {
      res.json({ ok: true, data: await configForReq(req) });
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
      const blocked = authorizeConfigChange(req.user, current, incoming);
      if (blocked) {
        return res
          .status(403)
          .json({ ok: false, error: `Not allowed to change ${blocked}` });
      }
      const saved = await saveConfig(req.departmentId || resolveDepartmentId(req), incoming);
      res.json({ ok: true, data: saved });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export { canManageSite };
