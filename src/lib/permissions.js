/*
 * Permission helpers. The model is intentionally simple and data-driven:
 *  - config.groups defines the ordered permission groups (member → admin).
 *  - each page declares an `access` array of group ids that may view it.
 *  - a user has one primary `group`; `admin` (or isAdmin) sees everything.
 *
 * The backend is responsible for resolving a member's Discord roles into a
 * group on login (see config.auth.roleMappings); the front-end only enforces
 * visibility based on the resolved group.
 */

export function isAdmin(user) {
  return Boolean(user?.isAdmin || user?.group === "admin");
}

export function canAccessPage(user, page) {
  if (!user || !page) return false;
  if (isAdmin(user)) return true;
  if (!Array.isArray(page.access) || page.access.length === 0) return true;
  return page.access.includes(user.group);
}

export function groupLabel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.label || groupId;
}

export function groupLevel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.level ?? 0;
}
