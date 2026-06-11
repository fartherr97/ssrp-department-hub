/*
 * Permission helpers, capability + hierarchy based.
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
 * Pages: admin pages (builder/access/audit) have fixed capability rules; any
 * other page is viewable by all signed-in members unless it opts into group
 * restrictions (page.restricted + access list).
 */

/*
 * The capability registry, the single source of truth for what a group can be
 * granted. Access & Roles renders its toggles from this list, so adding a new
 * capability here (plus enforcement helpers below) automatically surfaces it
 * in the UI for every department.
 */
export const CAPABILITIES = [
  {
    key: "manageSite",
    title: "Manage site",
    desc: "Open the Builder Portal: branding, pages, roster setup, backups. Implies every other capability.",
  },
  {
    key: "manageAccess",
    title: "Manage access & roles",
    desc: "Create groups and assign people, within their own level.",
  },
  {
    key: "editRoster",
    title: "Edit the main roster",
    desc: "Edit the main department roster. Also unlocks the structure pages: vehicle roster, uniform roster, and chain of command.",
  },
  {
    key: "editSubdivisions",
    title: "Edit subdivision rosters",
    desc: "Edit the non-main subdivision rosters.",
  },
  {
    key: "manageCalendar",
    title: "Manage calendar",
    desc: "Add, edit, and delete department calendar events. Anyone signed in can mark attendance.",
  },
  {
    key: "manageLogs",
    title: "Write administrative logs",
    desc: "Add entries to administrative log pages (admin log, FTO, interview, booth). They can edit/delete their own entries; editing anyone's requires Manage access or Manage site.",
  },
];

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

// Change a group's capabilities / delete it, needs manageAccess AND the group
// must be at or below the user's own level (no editing groups above your own).
export function canAdministerGroup(user, config, group) {
  if (!group) return false;
  if (user?.isAdmin) return true; // backend super-admin bypasses the hierarchy
  return canManageAccess(user, config) && (group.level ?? 0) <= userLevel(user, config);
}

// Add/remove a group's members, admins of it, or a manager of it.
export function canManageGroupMembers(user, config, group) {
  return canAdministerGroup(user, config, group) || isManagerOf(user, config, group);
}

// Who can open the Builder Portal at all (some tabs may still be hidden inside).
export function canOpenBuilder(user, config) {
  return canManageSite(user, config) || canManageAccess(user, config) || isManagerOfAny(user, config);
}

// Calendar entries (add/edit/delete + archiving), typically Command and up.
export function canManageCalendar(user, config) {
  return hasCapability(user, config, "manageCalendar") || canManageSite(user, config);
}

// Administrative log pages: writing entries.
export function canWriteLogs(user, config) {
  return hasCapability(user, config, "manageLogs") || canManageSite(user, config);
}

// Vehicle roster (fleet) pages, main-roster editors and site managers.
export function canEditFleet(user, config) {
  return hasCapability(user, config, "editRoster") || canManageSite(user, config);
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

// Structural roster edits (add/remove subdivisions, shared columns), main-roster
// editors and site managers only.
export function canEditRosterStructure(user, config) {
  return hasCapability(user, config, "editRoster") || canManageSite(user, config);
}

export function canAccessPage(user, page, config) {
  if (!user || !page) return false;
  if (page.type === "builder") return canManageSite(user, config);
  if (page.type === "access") return canManageAccess(user, config) || isManagerOfAny(user, config);
  if (page.type === "audit") {
    // Oversight tool, visible to staff (anyone who can edit or manage).
    return (
      canManageSite(user, config) ||
      canManageAccess(user, config) ||
      canEditAnyRoster(user, config) ||
      isManagerOfAny(user, config)
    );
  }
  // Content pages may opt in to group restrictions (page.restricted + access
  // list of group ids). Site managers and backend admins always see every page
  // so a Department Head can't lock themselves out of something they built.
  if (page.restricted && Array.isArray(page.access) && page.access.length) {
    if (user.isAdmin || canManageSite(user, config)) return true;
    return page.access.includes(user.group);
  }
  return true; // every other page is viewable by any signed-in member
}

export function groupLabel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.label || groupId;
}

export function groupLevel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.level ?? 0;
}
