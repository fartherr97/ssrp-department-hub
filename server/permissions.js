/*
 * Server-side authorization. The README is emphatic about this: the client
 * permission checks are UX only — the backend MUST re-check every capability on
 * every protected request.
 *
 * We do that by reusing the SAME pure modules the front-end uses
 * (src/lib/permissions.js), so there is exactly one definition of "can this
 * user do X" and the two can never drift apart.
 */
import {
  hasCapability,
  canManageSite,
  canManageAccess,
  canAccessPage,
  canEditAnyRoster,
  isManagerOfAny,
} from "../src/lib/permissions.js";
import { resolveDepartmentId } from "./tenant.js";

/*
 * Resolve a Discord member to a permission group, exactly as documented in the
 * README: first an explicit assignment (their Discord id listed in a group's
 * members), then a Discord-role → group mapping. Highest level wins.
 */
export function resolveUserGroup(config, discordId, roleIds = []) {
  const groups = config?.groups || [];
  const roles = new Set(roleIds.map(String));

  const matches = [];
  for (const g of groups) {
    const explicit = (g.members || []).some(
      (m) => m.discordId && String(m.discordId) === String(discordId)
    );
    const byRole = (config?.auth?.roleMappings || []).some(
      (rm) => rm.group === g.id && rm.roleId && roles.has(String(rm.roleId))
    );
    if (explicit || byRole) matches.push(g);
  }
  if (!matches.length) return null;
  matches.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  return matches[0];
}

// Build the user object the front-end expects (see README "Auth" section).
// `loginDepartmentId` records which department this session was minted for, so a
// stolen/replayed cookie can't be pointed at another tenant via the Host header
// (enforced in hydrateSessionUser). `group`/`isAdmin` here are a login-time
// snapshot for display only — every /api request re-derives them server-side.
export function buildSessionUser(config, profile, departmentId) {
  const group = resolveUserGroup(config, profile.discordId, profile.roleIds);
  return {
    id: profile.discordId,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    avatarUrl: profile.avatarUrl || "",
    group: group?.id || null,
    isAdmin: !!group?.manageSite,
    loginDepartmentId: departmentId || null,
    // Kept so features can gate on a specific Discord role (e.g. exam access).
    roleIds: (profile.roleIds || []).map(String),
  };
}

/*
 * Re-derive the caller's group and privileges from the CURRENT department's
 * config on every request, and refuse a session that was minted for a different
 * department. This is the server-authoritative core of the auth model:
 *
 *   • Cross-tenant defense: the session is bound to loginDepartmentId; a cookie
 *     replayed against another tenant's Host is rejected (403). Even without the
 *     binding, a real user's group is resolved by identity (discordId + Discord
 *     roleIds) against THIS config, so they never inherit a same-named group in a
 *     department they don't actually belong to.
 *   • No stale privilege: isAdmin/group are recomputed here, so a demotion in
 *     Access & Roles takes effect on the very next request instead of lingering
 *     in the session for the life of the 14-day cookie.
 *
 * We reassign req.user to a fresh object (never mutate the session copy) so this
 * never accidentally persists back into the session store.
 */
// Re-derive a user's group + isAdmin from a specific department's config. Pure;
// returns a NEW user object (never mutates the session copy). This is the single
// definition of "who is this caller, right now, in this department" — used by the
// per-request middleware below and by /auth/me so the client UI reflects a
// demotion immediately too.
export function reconcileUserWithConfig(user, config) {
  if (!user) return user;
  if (user.isDev) {
    // Dev sessions pick a group directly; still resolve isAdmin from THIS
    // department's config so a dev cookie can't carry manageSite elsewhere.
    const g = (config?.groups || []).find((x) => x.id === user.group) || null;
    return { ...user, isAdmin: !!g?.manageSite };
  }
  const g = resolveUserGroup(config, user.id, user.roleIds);
  return { ...user, group: g?.id || null, isAdmin: !!g?.manageSite };
}

export function hydrateSessionUser(getConfig) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();
      const deptId = req.departmentId || resolveDepartmentId(req);
      // Bind the session to the department it was created for.
      if (req.user.loginDepartmentId && req.user.loginDepartmentId !== deptId) {
        return res
          .status(403)
          .json({ ok: false, error: "Session is not valid for this department" });
      }
      const config = await getConfig(req);
      req.user = reconcileUserWithConfig(req.user, config);
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Express middleware ──────────────────────────────────────────────────────

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Not signed in" });
  next();
}

// Gate a route on a single capability key (manageSite, manageLogs, …).
export function requireCapability(key, getConfig) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not signed in" });
    const config = await getConfig(req);
    if (!hasCapability(req.user, config, key)) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    next();
  };
}

// "Staff" = anyone with an oversight role: site managers, access managers, any
// roster editor, or a manager of any group. Mirrors the visibility rule for the
// Audit page (canAccessPage type "audit") so the audit + version-history APIs are
// only readable by people who can already see that data in the UI.
export function isStaff(user, config) {
  return (
    canManageSite(user, config) ||
    canManageAccess(user, config) ||
    canEditAnyRoster(user, config) ||
    isManagerOfAny(user, config)
  );
}

// Gate a route on staff status (see isStaff). getConfig(req) → the dept config.
export function requireStaff(getConfig) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Not signed in" });
    const config = await getConfig(req);
    if (!isStaff(req.user, config)) {
      return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }
    next();
  };
}

export { canManageSite, canManageAccess, canAccessPage };
