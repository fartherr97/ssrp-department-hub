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
} from "../src/lib/permissions.js";

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
export function buildSessionUser(config, profile) {
  const group = resolveUserGroup(config, profile.discordId, profile.roleIds);
  return {
    id: profile.discordId,
    username: profile.username,
    displayName: profile.displayName || profile.username,
    avatarUrl: profile.avatarUrl || "",
    group: group?.id || null,
    isAdmin: !!group?.manageSite,
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

export { canManageSite, canManageAccess, canAccessPage };
