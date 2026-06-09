/*
 * Pure, immutable helpers for editing the roster slice of config. Each returns
 * a new config object so they can be used directly inside useConfig().mutate.
 *
 * Roster shape (v2):
 *   config.roster.memberFields: [{ id, label, type, options?, pill?, optionColors? }]
 *   config.roster.subdivisions: [{ id, name, accent?, banner?, ranks, categories }]
 *     rank (title): { id, name, insigniaUrl? }     // e.g. Colonel, Captain
 *     category:     { id, name, color, insigniaUrl?, members }  // the colored band
 *     member:       { id, name, rank, discordId, avatarUrl, fields }
 *
 * "Categories" are the colored grouping bands (Department Heads, Command Staff…).
 * "Ranks" are the titles a member can hold, shown in the Rank column.
 */

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function setSubdivisions(config, subdivisions) {
  return { ...config, roster: { ...config.roster, subdivisions } };
}

// Map over a single subdivision's categories, leaving the others untouched.
function mapCategories(config, subId, fn) {
  return setSubdivisions(
    config,
    config.roster.subdivisions.map((s) =>
      s.id === subId ? { ...s, categories: fn(s.categories || []) } : s
    )
  );
}

// Map over a single subdivision's rank titles.
function mapRanks(config, subId, fn) {
  return setSubdivisions(
    config,
    config.roster.subdivisions.map((s) =>
      s.id === subId ? { ...s, ranks: fn(s.ranks || []) } : s
    )
  );
}

export function findSubdivision(config, subId) {
  return config.roster.subdivisions.find((s) => s.id === subId) || null;
}

// ─── Subdivisions ────────────────────────────────────────────────────────────

export function addSubdivision(config, { id = uid("sub"), name = "New Subdivision" } = {}) {
  const sub = { id, name, ranks: [], categories: [] };
  return setSubdivisions(config, [...config.roster.subdivisions, sub]);
}

export function updateSubdivision(config, subId, patch) {
  return setSubdivisions(
    config,
    config.roster.subdivisions.map((s) => (s.id === subId ? { ...s, ...patch } : s))
  );
}

export function deleteSubdivision(config, subId) {
  // Never allow deleting the last subdivision — the roster must have one tab.
  if (config.roster.subdivisions.length <= 1) return config;
  return setSubdivisions(
    config,
    config.roster.subdivisions.filter((s) => s.id !== subId)
  );
}

export function moveSubdivision(config, subId, dir) {
  const subs = [...config.roster.subdivisions];
  const i = subs.findIndex((s) => s.id === subId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= subs.length) return config;
  [subs[i], subs[j]] = [subs[j], subs[i]];
  return setSubdivisions(config, subs);
}

// ─── Rank titles (within a subdivision) ──────────────────────────────────────

export function addRank(config, subId, { name = "New Rank", insigniaUrl = "" } = {}) {
  const rank = { id: uid("rank"), name, insigniaUrl };
  return mapRanks(config, subId, (ranks) => [...ranks, rank]);
}

export function updateRank(config, subId, rankId, patch) {
  return mapRanks(config, subId, (ranks) =>
    ranks.map((r) => (r.id === rankId ? { ...r, ...patch } : r))
  );
}

export function deleteRank(config, subId, rankId) {
  // Drop the rank title and clear it from any member that held it.
  const next = mapRanks(config, subId, (ranks) => ranks.filter((r) => r.id !== rankId));
  return mapCategories(next, subId, (cats) =>
    cats.map((c) => ({
      ...c,
      members: c.members.map((m) => (m.rank === rankId ? { ...m, rank: "" } : m)),
    }))
  );
}

export function moveRank(config, subId, rankId, dir) {
  return mapRanks(config, subId, (ranks) => {
    const next = [...ranks];
    const i = next.findIndex((r) => r.id === rankId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return ranks;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

// ─── Categories (the colored bands, within a subdivision) ────────────────────

export function addCategory(config, subId, { name = "New Category", color = "#3b82f6", insigniaUrl = "" } = {}) {
  const category = { id: uid("cat"), name, color, insigniaUrl, members: [] };
  return mapCategories(config, subId, (cats) => [...cats, category]);
}

export function updateCategory(config, subId, categoryId, patch) {
  return mapCategories(config, subId, (cats) =>
    cats.map((c) => (c.id === categoryId ? { ...c, ...patch } : c))
  );
}

export function deleteCategory(config, subId, categoryId) {
  return mapCategories(config, subId, (cats) => cats.filter((c) => c.id !== categoryId));
}

export function moveCategory(config, subId, categoryId, dir) {
  return mapCategories(config, subId, (cats) => {
    const next = [...cats];
    const i = next.findIndex((c) => c.id === categoryId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return cats;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

// ─── Members (within a category) ─────────────────────────────────────────────

export function addMember(config, subId, categoryId, member = {}) {
  const newMember = {
    id: uid("member"),
    name: member.name || "New Member",
    rank: member.rank || "",
    discordId: member.discordId || "",
    avatarUrl: member.avatarUrl || "",
    fields: member.fields || {},
  };
  return mapCategories(config, subId, (cats) =>
    cats.map((c) => (c.id === categoryId ? { ...c, members: [...c.members, newMember] } : c))
  );
}

export function updateMember(config, subId, categoryId, memberId, patch) {
  return mapCategories(config, subId, (cats) =>
    cats.map((c) =>
      c.id === categoryId
        ? { ...c, members: c.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) }
        : c
    )
  );
}

export function deleteMember(config, subId, categoryId, memberId) {
  return mapCategories(config, subId, (cats) =>
    cats.map((c) =>
      c.id === categoryId ? { ...c, members: c.members.filter((m) => m.id !== memberId) } : c
    )
  );
}

// Move a member to another category within the same subdivision (appended), or
// reorder within a category by index.
export function moveMember(config, subId, fromCatId, memberId, toCatId, toIndex = null) {
  return mapCategories(config, subId, (cats) => {
    let moving = null;
    const stripped = cats.map((c) => {
      if (c.id !== fromCatId) return c;
      const members = c.members.filter((m) => {
        if (m.id === memberId) {
          moving = m;
          return false;
        }
        return true;
      });
      return { ...c, members };
    });
    if (!moving) return cats;
    return stripped.map((c) => {
      if (c.id !== toCatId) return c;
      const members = [...c.members];
      const idx = toIndex == null ? members.length : Math.max(0, Math.min(toIndex, members.length));
      members.splice(idx, 0, moving);
      return { ...c, members };
    });
  });
}

// ─── Member fields (shared custom columns) ───────────────────────────────────

export function addMemberField(config, field = {}) {
  const f = {
    id: uid("field"),
    label: field.label || "New Field",
    type: field.type || "text",
    ...(field.type === "select" ? { options: field.options || [] } : {}),
  };
  return {
    ...config,
    roster: { ...config.roster, memberFields: [...config.roster.memberFields, f] },
  };
}

export function updateMemberField(config, fieldId, patch) {
  return {
    ...config,
    roster: {
      ...config.roster,
      memberFields: config.roster.memberFields.map((f) =>
        f.id === fieldId ? { ...f, ...patch } : f
      ),
    },
  };
}

export function deleteMemberField(config, fieldId) {
  const stripMember = (m) => {
    if (!m.fields || !(fieldId in m.fields)) return m;
    const fields = { ...m.fields };
    delete fields[fieldId];
    return { ...m, fields };
  };
  return {
    ...config,
    roster: {
      ...config.roster,
      memberFields: config.roster.memberFields.filter((f) => f.id !== fieldId),
      // strip the value from every member in every subdivision
      subdivisions: config.roster.subdivisions.map((s) => ({
        ...s,
        categories: (s.categories || []).map((c) => ({
          ...c,
          members: c.members.map(stripMember),
        })),
      })),
    },
  };
}
