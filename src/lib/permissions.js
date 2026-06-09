/*
 * Permission helpers — capability + hierarchy based.
 *
 * Each group in config.groups carries capability flags and a member list:
 *   { id, label, level, manageSite, manageAccess, editRoster, editSubdivisions,
 *     members: [{ id, name, discordId, role: "member" | "manager" }] }
 *
 *  - manageSite       → open the Builder Portal config (branding, pages, …)
 *  - manageAccess     → manage groups & members (subject to hierarchy)
 *  - editRoster       → edit the main roster(s)
 *  - editSubdivisions → edit subdivision (non-main) rosters
 *
 * Hierarchy: you can only administer groups at or below your own `level`.
 * Within a group you may also be a "manager", which lets you add/remove its
 * members even without manageAccess.
 *
 * Every page is viewable by any signed-in member except the Builder Portal,
 * which requires a management capability.
 */

export function userGroup(config, user) {
  return config?.groups?.find((g) => g.id === user?.group) || null;
}

export function hasCapability(user, config, key) {
  if (user?.isAdmin) return true;
  const g = userGroup(config, user);
  if (!g) return false;
  if (g[key]) return true;
  // Legacy fallback for configs predating capability flags.
  if (g.isAdmin || g.id === "admin") return true;
  if ((key === "editRoster" || key === "editSubdivisions") && g.canEditRoster) return true;
  return false;
}

export function canManageSite(user, config) {
  return hasCapability(user, config, "manageSite");
}

export function canManageAccess(user, config) {
  return hasCapability(user, config, "manageAccess");
}

// Kept for existing call sites — "admin" now means "can manage the site config".
export function isAdmin(user, config) {
  return canManageSite(user, config);
}

export function userLevel(user, config) {
  return userGroup(config, user)?.level ?? 0;
}

export function isManagerOf(user, config, group) {
  if (!group || !user?.id) return false;
  return (group.members || []).some((m) => m.role === "manager" && m.discordId && m.discordId === user.id);
}

export function isManagerOfAny(user, config) {
  return (config?.groups || []).some((g) => isManagerOf(user, config, g));
}

// Change a group's capabilities / delete it — needs manageAccess AND the group
// must be at or below the user's own level (no editing groups above your own).
export function canAdministerGroup(user, config, group) {
  if (!group) return false;
  if (user?.isAdmin) return true; // backend super-admin bypasses the hierarchy
  return canManageAccess(user, config) && (group.level ?? 0) <= userLevel(user, config);
}

// Add/remove a group's members — admins of it, or a manager of it.
export function canManageGroupMembers(user, config, group) {
  return canAdministerGroup(user, config, group) || isManagerOf(user, config, group);
}

// Who can open the Builder Portal at all (some tabs may still be hidden inside).
export function canOpenBuilder(user, config) {
  return canManageSite(user, config) || canManageAccess(user, config) || isManagerOfAny(user, config);
}

// Roster editing is per-subdivision: the main roster needs editRoster; the
// subdivisions need editSubdivisions (editRoster implies both).
export function canEditSubdivision(user, config, sub) {
  if (sub?.main) return hasCapability(user, config, "editRoster");
  return hasCapability(user, config, "editSubdivisions") || hasCapability(user, config, "editRoster");
}

export function canEditAnyRoster(user, config) {
  return hasCapability(user, config, "editRoster") || hasCapability(user, config, "editSubdivisions");
}

// Structural roster edits (add/remove subdivisions, shared columns) — main-roster
// editors and site managers only.
export function canEditRosterStructure(user, config) {
  return hasCapability(user, config, "editRoster") || canManageSite(user, config);
}

export function canAccessPage(user, page, config) {
  if (!user || !page) return false;
  if (page.type === "builder") return canManageSite(user, config);
  if (page.type === "access") return canManageAccess(user, config) || isManagerOfAny(user, config);
  return true; // every other page is viewable by any signed-in member
}

export function groupLabel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.label || groupId;
}

export function groupLevel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.level ?? 0;
}
