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
  {
    key: "editRosterLimited",
    title: "Edit junior ranks only (training / recruiting)",
    desc: "Add and manage main-roster members up to a chosen rank ceiling (e.g. Cadet up to Police Officer I), and promote them within that range. Lets training/recruiting supervisors onboard and pass cadets without full roster access. Set the ceiling rank below.",
    hasRankCeiling: true,
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
// The level rule applies to EVERYONE, including "manage site" users — you can
// never administer a rank/group above your own. The only bypass is a genuine
// backend super-admin with no group of their own (e.g. a break-glass account).
export function canAdministerGroup(user, config, group) {
  if (!group) return false;
  if (user?.isAdmin && !userGroup(config, user)) return true; // groupless super-admin
  return canManageAccess(user, config) && (group.level ?? 0) <= userLevel(user, config);
}

// Add/remove a group's members, admins of it, or a manager of it.
export function canManageGroupMembers(user, config, group) {
  return canAdministerGroup(user, config, group) || isManagerOf(user, config, group);
}

/*
 * Whole-config authorization for group/role hierarchy — the backend calls this so
 * the client checks can't be bypassed. Given the current config and an incoming
 * one, it rejects any change that would let someone act above their own rank:
 *   • creating/editing/deleting a group above their level (before OR after),
 *   • raising a group they can touch above their own level,
 *   • granting a capability they don't personally hold,
 *   • mapping a Discord role to a group above their level.
 * Returns a human-readable reason string, or null if the change is allowed.
 * A groupless backend super-admin (isAdmin, no group) bypasses all of it.
 */
export function authorizeGroupHierarchy(user, current, incoming) {
  if (user?.isAdmin && !userGroup(current, user)) return null;
  const myLevel = userLevel(user, current);
  const canAccess = canManageAccess(user, current);
  const curById = new Map((current?.groups || []).map((g) => [g.id, g]));
  const incById = new Map((incoming?.groups || []).map((g) => [g.id, g]));

  for (const id of new Set([...curById.keys(), ...incById.keys()])) {
    const before = curById.get(id);
    const after = incById.get(id);
    if (JSON.stringify(before) === JSON.stringify(after)) continue; // unchanged
    if (!canAccess) return "groups or access settings";
    if (before && (before.level ?? 0) > myLevel) return "a group above your level";
    if (after && (after.level ?? 0) > myLevel) return "a group above your level";
    if (after) {
      for (const cap of CAPABILITIES) {
        if (after[cap.key] && !before?.[cap.key] && !hasCapability(user, current, cap.key)) {
          return `a permission you don't have (${cap.title})`;
        }
      }
    }
  }

  // Role → group mappings can't be pointed at a group above your level.
  const curMaps = current?.auth?.roleMappings || [];
  const incMaps = incoming?.auth?.roleMappings || [];
  if (JSON.stringify(curMaps) !== JSON.stringify(incMaps)) {
    if (!canAccess) return "role mappings";
    const seen = new Set(curMaps.map((m) => JSON.stringify(m)));
    const levelOf = (gid) => incById.get(gid)?.level ?? curById.get(gid)?.level ?? 0;
    for (const m of incMaps) {
      if (seen.has(JSON.stringify(m))) continue; // unchanged mapping
      if (levelOf(m.group) > myLevel) return "a role mapping to a group above your level";
    }
  }
  return null;
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

// ── Limited ("junior ranks only") roster editing ────────────────────────────
// A group with editRosterLimited can manage MAIN-roster members up to a rank
// ceiling (config.groups[].rosterRankCeiling = a rank id in the main roster).
// That rank and everything below it in roster order, plus rank-less cadets, are
// editable; higher ranks are read-only to them. This is enforcement the backend
// must mirror — the client checks are UX only.

export function rosterRankCeiling(user, config) {
  return userGroup(config, user)?.rosterRankCeiling || null;
}

// Does this user have limited-edit rights on this subdivision (main roster only)?
export function canEditRosterLimited(user, config, sub) {
  if (!sub?.main) return false;
  return hasCapability(user, config, "editRosterLimited") && !!rosterRankCeiling(user, config);
}

// Is a rank id at or below the ceiling in the roster's own order (highest-first)?
export function rankWithinCeiling(sub, rankId, ceilingId) {
  const ranks = sub?.ranks || [];
  const ceilIdx = ranks.findIndex((r) => r.id === ceilingId);
  if (ceilIdx < 0) return false;
  if (!rankId) return true; // no rank yet (cadet/recruit) → junior → editable
  const rIdx = ranks.findIndex((r) => r.id === rankId);
  return rIdx < 0 ? true : rIdx >= ceilIdx;
}

// Can this user edit THIS member (used for per-row controls + saves)?
export function canEditMember(user, config, sub, member) {
  if (canEditSubdivision(user, config, sub) || canManageSite(user, config)) return true;
  if (!canEditRosterLimited(user, config, sub)) return false;
  return rankWithinCeiling(sub, member?.rank, rosterRankCeiling(user, config));
}

// The rank objects a limited editor may assign (ceiling and below); full editors
// get all ranks. Drives the rank dropdown + promotion options.
export function assignableRanks(user, config, sub) {
  const ranks = sub?.ranks || [];
  if (canEditSubdivision(user, config, sub) || canManageSite(user, config)) return ranks;
  if (!canEditRosterLimited(user, config, sub)) return [];
  const ceilingId = rosterRankCeiling(user, config);
  const ceilIdx = ranks.findIndex((r) => r.id === ceilingId);
  return ceilIdx < 0 ? [] : ranks.slice(ceilIdx);
}

// Structural roster edits (add/remove subdivisions, shared columns), main-roster
// editors and site managers only.
export function canEditRosterStructure(user, config) {
  return hasCapability(user, config, "editRoster") || canManageSite(user, config);
}

// ── Membership tier ──────────────────────────────────────────────────────────
// A Department Member is anyone who resolves to a permission group — i.e. one of
// their Discord roles is mapped to a group on this site (or they're explicitly
// assigned, or they're a backend admin). Everyone else who's merely signed in is
// a Visitor: they only see pages a builder has opted in for visitors.
export function isDepartmentMember(user, config) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!userGroup(config, user);
}
export function isVisitor(user, config) {
  return !!user && !isDepartmentMember(user, config);
}

export function canAccessPage(user, page, config) {
  if (!user || !page) return false;
  if (page.type === "builder") return canManageSite(user, config);
  // Help page (guide + assistant) is a building aid — managers only, like Builder.
  if (page.type === "help") return canManageSite(user, config);
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
  const member = isDepartmentMember(user, config);
  if (page.restricted && Array.isArray(page.access) && page.access.length) {
    if (user.isAdmin || canManageSite(user, config)) return true;
    // Group-restricted pages are for members in those groups; visitors (no group)
    // never match.
    return member && page.access.includes(user.group);
  }
  // Default: Department Members see every content page. Visitors (signed in but
  // not in the department) only see pages a builder has opted in for them.
  if (!member) return !!page.visitorVisible;
  return true;
}

export function groupLabel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.label || groupId;
}

export function groupLevel(config, groupId) {
  return config?.groups?.find((g) => g.id === groupId)?.level ?? 0;
}
