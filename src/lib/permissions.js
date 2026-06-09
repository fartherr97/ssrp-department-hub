/*
 * Permission helpers. The model is data-driven and group-based:
 *  - config.groups defines the permission groups. Each group carries capability
 *    flags (isAdmin, canEditRoster) and an explicit `members` list
 *    ([{ id, name, discordId }]) — people assigned to that group, Google-Groups
 *    style. The backend resolves a member's group(s) on login (by Discord ID
 *    membership and/or config.auth.roleMappings).
 *  - each page declares an `access` array of group ids that may view it.
 *  - a user has one primary `group`; an admin group sees everything.
 *
 * The front-end only enforces visibility/capabilities from the resolved group.
 */

export function userGroup(config, user) {
  return config?.groups?.find((g) => g.id === user?.group) || null;
}

export function isAdmin(user, config) {
  if (user?.isAdmin) return true;
  if (user?.group === "admin") return true; // legacy default admin group
  return Boolean(userGroup(config, user)?.isAdmin);
}

export function canEditRoster(user, config) {
  if (isAdmin(user, config)) return true;
  const group = userGroup(config, user);
  if (group && typeof group.canEditRoster === "boolean") return group.canEditRoster;
  // Legacy fallback for configs predating capability flags: command level and up.
  return groupLevel(config, user?.group) >= groupLevel(config, "command");
}

export function canAccessPage(user, page, config) {
  if (!user || !page) return false;
  if (isAdmin(user, config)) return true;
  if (!Array.isArray(page.access) || page.access.length === 0) return true;
  return page.access.includes(user.group);
}

export function groupLabel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.label || groupId;
}

export function groupLevel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.level ?? 0;
}
