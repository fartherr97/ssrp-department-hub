/*
 * Pure, immutable helpers for editing the roster slice of config. Each returns
 * a new config object so they can be used directly inside useConfig().mutate.
 *
 * Roster shape:
 *   config.roster.memberFields: [{ id, label, type, options? }]   // shared columns
 *   config.roster.subdivisions: [{ id, name, ranks }]             // tabbed rosters
 *     rank:   { id, name, color, members }
 *     member: { id, name, discordId, avatarUrl, fields }
 *
 * Rank/member operations take a subdivisionId so they target one tab's roster.
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

// Map over a single subdivision's ranks, leaving the others untouched.
function mapRanks(config, subId, fn) {
  return setSubdivisions(
    config,
    config.roster.subdivisions.map((s) =>
      s.id === subId ? { ...s, ranks: fn(s.ranks) } : s
    )
  );
}

export function findSubdivision(config, subId) {
  return config.roster.subdivisions.find((s) => s.id === subId) || null;
}

// ─── Subdivisions ────────────────────────────────────────────────────────────

export function addSubdivision(config, { id = uid("sub"), name = "New Subdivision" } = {}) {
  const sub = { id, name, ranks: [] };
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

// ─── Ranks (within a subdivision) ────────────────────────────────────────────

export function addRank(config, subId, { name = "New Rank", color = "#3b82f6" } = {}) {
  const rank = { id: uid("rank"), name, color, members: [] };
  return mapRanks(config, subId, (ranks) => [...ranks, rank]);
}

export function updateRank(config, subId, rankId, patch) {
  return mapRanks(config, subId, (ranks) =>
    ranks.map((r) => (r.id === rankId ? { ...r, ...patch } : r))
  );
}

export function deleteRank(config, subId, rankId) {
  return mapRanks(config, subId, (ranks) => ranks.filter((r) => r.id !== rankId));
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

// ─── Members (within a subdivision) ──────────────────────────────────────────

export function addMember(config, subId, rankId, member = {}) {
  const newMember = {
    id: uid("member"),
    name: member.name || "New Member",
    discordId: member.discordId || "",
    avatarUrl: member.avatarUrl || "",
    fields: member.fields || {},
  };
  return mapRanks(config, subId, (ranks) =>
    ranks.map((r) => (r.id === rankId ? { ...r, members: [...r.members, newMember] } : r))
  );
}

export function updateMember(config, subId, rankId, memberId, patch) {
  return mapRanks(config, subId, (ranks) =>
    ranks.map((r) =>
      r.id === rankId
        ? { ...r, members: r.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)) }
        : r
    )
  );
}

export function deleteMember(config, subId, rankId, memberId) {
  return mapRanks(config, subId, (ranks) =>
    ranks.map((r) =>
      r.id === rankId ? { ...r, members: r.members.filter((m) => m.id !== memberId) } : r
    )
  );
}

// Move a member to another rank within the same subdivision (appended), or
// reorder within a rank by index.
export function moveMember(config, subId, fromRankId, memberId, toRankId, toIndex = null) {
  return mapRanks(config, subId, (ranks) => {
    let moving = null;
    const stripped = ranks.map((r) => {
      if (r.id !== fromRankId) return r;
      const members = r.members.filter((m) => {
        if (m.id === memberId) {
          moving = m;
          return false;
        }
        return true;
      });
      return { ...r, members };
    });
    if (!moving) return ranks;
    return stripped.map((r) => {
      if (r.id !== toRankId) return r;
      const members = [...r.members];
      const idx = toIndex == null ? members.length : Math.max(0, Math.min(toIndex, members.length));
      members.splice(idx, 0, moving);
      return { ...r, members };
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
        ranks: s.ranks.map((r) => ({ ...r, members: r.members.map(stripMember) })),
      })),
    },
  };
}
