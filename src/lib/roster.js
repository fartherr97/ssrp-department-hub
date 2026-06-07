/*
 * Pure, immutable helpers for editing the roster slice of config. Each returns
 * a new config object so they can be used directly inside useConfig().mutate.
 *
 * Roster shape:
 *   config.roster.memberFields: [{ id, label, type, options? }]
 *   config.roster.ranks: [{ id, name, color, members: [{ id, name, discordId, avatarUrl, fields }] }]
 */

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function withRoster(config, ranks) {
  return { ...config, roster: { ...config.roster, ranks } };
}

// ─── Ranks ───────────────────────────────────────────────────────────────────

export function addRank(config, { name = "New Rank", color = "#3b82f6" } = {}) {
  const rank = { id: uid("rank"), name, color, members: [] };
  return withRoster(config, [...config.roster.ranks, rank]);
}

export function updateRank(config, rankId, patch) {
  return withRoster(
    config,
    config.roster.ranks.map((r) => (r.id === rankId ? { ...r, ...patch } : r))
  );
}

export function deleteRank(config, rankId) {
  return withRoster(
    config,
    config.roster.ranks.filter((r) => r.id !== rankId)
  );
}

export function moveRank(config, rankId, dir) {
  const ranks = [...config.roster.ranks];
  const i = ranks.findIndex((r) => r.id === rankId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ranks.length) return config;
  [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  return withRoster(config, ranks);
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function addMember(config, rankId, member = {}) {
  const newMember = {
    id: uid("member"),
    name: member.name || "New Member",
    discordId: member.discordId || "",
    avatarUrl: member.avatarUrl || "",
    fields: member.fields || {},
  };
  return withRoster(
    config,
    config.roster.ranks.map((r) =>
      r.id === rankId ? { ...r, members: [...r.members, newMember] } : r
    )
  );
}

export function updateMember(config, rankId, memberId, patch) {
  return withRoster(
    config,
    config.roster.ranks.map((r) =>
      r.id === rankId
        ? {
            ...r,
            members: r.members.map((m) =>
              m.id === memberId ? { ...m, ...patch } : m
            ),
          }
        : r
    )
  );
}

export function deleteMember(config, rankId, memberId) {
  return withRoster(
    config,
    config.roster.ranks.map((r) =>
      r.id === rankId
        ? { ...r, members: r.members.filter((m) => m.id !== memberId) }
        : r
    )
  );
}

// Move a member to another rank (appended), or reorder within a rank by index.
export function moveMember(config, fromRankId, memberId, toRankId, toIndex = null) {
  let moving = null;
  const stripped = config.roster.ranks.map((r) => {
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
  if (!moving) return config;

  const ranks = stripped.map((r) => {
    if (r.id !== toRankId) return r;
    const members = [...r.members];
    const idx = toIndex == null ? members.length : Math.max(0, Math.min(toIndex, members.length));
    members.splice(idx, 0, moving);
    return { ...r, members };
  });
  return withRoster(config, ranks);
}

export function reorderMember(config, rankId, memberId, dir) {
  const rank = config.roster.ranks.find((r) => r.id === rankId);
  if (!rank) return config;
  const i = rank.members.findIndex((m) => m.id === memberId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rank.members.length) return config;
  const members = [...rank.members];
  [members[i], members[j]] = [members[j], members[i]];
  return updateRank(config, rankId, { members });
}

// ─── Member fields (custom columns) ──────────────────────────────────────────

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
  return {
    ...config,
    roster: {
      ...config.roster,
      memberFields: config.roster.memberFields.filter((f) => f.id !== fieldId),
      // also strip the value from every member
      ranks: config.roster.ranks.map((r) => ({
        ...r,
        members: r.members.map((m) => {
          if (!m.fields || !(fieldId in m.fields)) return m;
          const fields = { ...m.fields };
          delete fields[fieldId];
          return { ...m, fields };
        }),
      })),
    },
  };
}
