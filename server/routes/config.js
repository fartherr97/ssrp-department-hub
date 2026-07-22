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
import { requireAuth, canManageSite, isStaff } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import { cloneDefaultConfig } from "../../src/config/defaultConfig.js";
import {
  canManageAccess,
  canEditAnyRoster,
  hasCapability,
  canManageCalendar,
  canWriteLogs,
  authorizeGroupHierarchy,
  isDepartmentMember,
  rosterRankCeiling,
  rankWithinCeiling,
} from "../../src/lib/permissions.js";
import {
  publicConfig,
  redactSensitive,
  mergeRedactedBack,
  redactRoleMappings,
  redactMemberIds,
} from "../configView.js";

// Shape the config to what the caller is allowed to see:
//   • site manager        → the full document (secrets and all)
//   • other staff         → redactSensitive (webhook URLs blanked)
//   • rank-and-file member → + role mappings / guild id stripped (access metadata)
//   • signed-in visitor    → + roster member Discord ids stripped (directory PII)
// Guests (no session) are handled with publicConfig at the call sites.
function viewConfigFor(user, config) {
  if (canManageSite(user, config)) return config;
  let view = redactSensitive(config);
  if (!isStaff(user, config)) {
    view = redactRoleMappings(view);
    if (!isDepartmentMember(user, config)) view = redactMemberIds(view);
  }
  return view;
}

const MAX_CONFIG_BYTES = 16 * 1024 * 1024; // 16 MB ceiling on a single config doc

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

// Main-roster members keyed by id, plus the main subdivision itself. The rank
// ceiling is defined against the main roster only (see canEditRosterLimited).
function mainRosterMembers(config) {
  const main = (config?.roster?.subdivisions || []).find((s) => s.main);
  const members = new Map();
  for (const cat of main?.categories || []) {
    for (const m of cat.members || []) members.set(m.id, m);
  }
  return { main, members };
}

/*
 * Server-side enforcement of the "junior ranks only" ceiling. The client
 * (canEditMember / rankWithinCeiling / assignableRanks) is UX only; on the
 * whole-document PUT the server must independently confirm a limited editor only
 * adds/edits/removes MAIN-roster members at or below their ceiling — otherwise a
 * "recruiter" could promote anyone to the top rank or delete senior members.
 * Returns a human-readable reason string, or null if the change is allowed.
 */
function limitedRosterCeilingViolation(user, current, incoming) {
  const ceilingId = rosterRankCeiling(user, current);
  if (!ceilingId) return "the roster"; // limited editor with no ceiling configured
  const { main: curMain, members: cur } = mainRosterMembers(current);
  const { main: incMain, members: inc } = mainRosterMembers(incoming);
  // The rank ladder itself (ids + order) must be unchanged: the ceiling is an
  // index into it, so letting a limited editor renumber/rename ranks would let
  // them move their own ceiling.
  if (JSON.stringify(curMain?.ranks || []) !== JSON.stringify(incMain?.ranks || [])) {
    return "roster ranks";
  }
  const withinCeiling = (rankId) => rankWithinCeiling(curMain, rankId, ceilingId);
  // Added or edited members must END UP at/below the ceiling, and an edited
  // existing member must have STARTED at/below it (can't touch seniors at all).
  for (const [id, m] of inc) {
    const before = cur.get(id);
    if (before && JSON.stringify(before) === JSON.stringify(m)) continue; // untouched
    if (!withinCeiling(m.rank)) return "a roster member above your rank ceiling";
    if (before && !withinCeiling(before.rank)) return "a roster member above your rank ceiling";
  }
  // Removals: only members at/below the ceiling may be removed.
  for (const [id, before] of cur) {
    if (!inc.has(id) && !withinCeiling(before.rank)) {
      return "a roster member above your rank ceiling";
    }
  }
  return null;
}

// Did any page's admin-log webhook URL change? A webhook URL is a Discord write
// credential (future log entries POST to it), so — like the site-level webhooks
// map — only a site manager may set or change one, even on a log page a
// log-writer is otherwise allowed to edit. Runs on the post-merge config, so an
// unchanged (REDACTED→restored) URL reads as equal and is not flagged.
function pageWebhookUrlChanged(current, incoming) {
  const curById = new Map((current?.pages || []).map((p) => [p.id, p]));
  for (const p of incoming?.pages || []) {
    const now = p?.config?.webhook?.url || "";
    const was = curById.get(p.id)?.config?.webhook?.url || "";
    if (now !== was) return true;
  }
  return false;
}

/*
 * Reconcile an incoming config from a writer with the view they were served,
 * BEFORE authorization/save:
 *   • site managers saw the full doc → trust it as-is.
 *   • everyone else had webhook URLs redacted → mergeRedactedBack restores the
 *     real secrets from storage so a routine save can't blank them (and the
 *     REDACTED sentinel doesn't read as a change).
 *   • non-manage-access writers additionally had the auth section (role
 *     mappings, guild id) stripped and may not change it anyway → pin it to
 *     stored, so the stripped view neither blanks it nor trips the auth gate.
 */
function prepareIncomingForSave(user, incoming, current) {
  if (canManageSite(user, current)) return incoming;
  let merged = mergeRedactedBack(incoming, current);
  if (!canManageAccess(user, current)) {
    merged = { ...merged, auth: current.auth };
  }
  return merged;
}

function authorizeConfigChange(user, current, incoming) {
  // Groups / auth (role mappings, capability grants) → manage-access or above,
  // AND the rank hierarchy: you can never create, edit, delete, or map a role to a
  // group above your own level, or grant a capability you don't hold yourself.
  if (changed(current, incoming, "groups") || changed(current, incoming, "auth")) {
    if (!canManageAccess(user, current) && !canManageSite(user, current)) {
      return "groups or access settings";
    }
    // The configured Discord guild is the SOURCE OF TRUTH for role→group
    // resolution at login; repointing it at an attacker-controlled guild is a
    // site-infrastructure change, so require manage-site (not just manage-access).
    if (
      String(current?.auth?.discordGuildId || "") !== String(incoming?.auth?.discordGuildId || "") &&
      !canManageSite(user, current)
    ) {
      return "the Discord guild";
    }
    const blockedHierarchy = authorizeGroupHierarchy(user, current, incoming);
    if (blockedHierarchy) return blockedHierarchy;
  }
  // Branding / navigation / page structure / webhooks → manage-site only.
  // (A webhook URL is a Discord write credential, so only managers may set it.)
  if (
    !canManageSite(user, current) &&
    (changed(current, incoming, "branding") ||
      changed(current, incoming, "navGroups") ||
      changed(current, incoming, "dropdownGroups") ||
      changed(current, incoming, "webhooks"))
  ) {
    return "site branding, navigation, or webhooks";
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
      // Confined to the main roster — now enforce the per-member rank ceiling
      // (client checks are UX only; this is the real gate).
      const violation = limitedRosterCeilingViolation(user, current, incoming);
      if (violation) return violation;
    }
  }
  // Page content: calendar pages need manage-calendar, log pages need manage-logs
  // (manage-site covers both). Other page types are covered by the structure and
  // section rules above / left to general writers.
  if (changed(current, incoming, "pages") && !canManageSite(user, current)) {
    // Permanently removing a page — its id disappears entirely, taking all its
    // nested data (submissions, votes, log entries) with it — is an
    // irreversible, manager-only action. Soft-delete (archiving) keeps the id,
    // so it is NOT blocked here; only true removal is.
    const incomingIds = new Set((incoming?.pages || []).map((p) => p.id));
    if ((current?.pages || []).some((p) => !incomingIds.has(p.id))) {
      return "deleting pages";
    }
    // A per-page admin-log webhook URL is a write credential, exactly like the
    // site-level webhooks map above — setting/changing one is manager-only even
    // for a log-writer who may otherwise edit the page's content.
    if (pageWebhookUrlChanged(current, incoming)) {
      return "an admin-log webhook URL";
    }
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
      return res.json({ ok: true, data: viewConfigFor(req.user, config) });
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
      // Reconcile the incoming doc with what the caller was actually allowed to
      // see (restore redacted secrets, pin sections they can't touch) before
      // authorizing/saving. See prepareIncomingForSave.
      const merged = prepareIncomingForSave(req.user, incoming, current);
      const blocked = authorizeConfigChange(req.user, current, merged);
      if (blocked) {
        return res
          .status(403)
          .json({ ok: false, error: `Not allowed to change ${blocked}` });
      }
      const saved = await saveConfig(req.departmentId || resolveDepartmentId(req), merged);
      // Echo back the same view the caller is allowed to see (don't leak secrets
      // a non-manager didn't have a moment ago).
      res.json({ ok: true, data: viewConfigFor(req.user, saved) });
    } catch (err) {
      next(err);
    }
  });

  // Whole-config restore (backup file or version-history snapshot). This is a
  // deliberate manager-only "replace everything" action, so it does NOT run the
  // per-section edit checks that guard ordinary saves — re-adding groups and
  // their capabilities is the whole point and must not be rejected. Manage-site
  // is required (same tier that can view/restore version history).
  router.put(
    "/config/restore",
    requireAuth,
    async (req, res, next) => {
      try {
        const incoming = req.body;
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          return res.status(400).json({ ok: false, error: "Config must be an object" });
        }
        if (Buffer.byteLength(JSON.stringify(incoming)) > MAX_CONFIG_BYTES) {
          return res.status(413).json({ ok: false, error: "Config too large" });
        }
        const departmentId = req.departmentId || resolveDepartmentId(req);
        const current = await currentConfig(departmentId);
        if (!canManageSite(req.user, current)) {
          return res.status(403).json({ ok: false, error: "Restoring requires Manage Site" });
        }
        const saved = await saveConfig(departmentId, incoming);
        res.json({ ok: true, data: saved });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

// Exported for unit tests (authorization is the security-critical surface).
export {
  canManageSite,
  authorizeConfigChange,
  prepareIncomingForSave,
  viewConfigFor,
  canWriteConfig,
};
