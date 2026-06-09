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

// ─── Promotion automation ────────────────────────────────────────────────────
// "Time in grade" (a `tenure` column) is computed from a date column — usually
// Date of Promotion. Changing someone's rank or category stamps that date to
// today, which resets their time in grade automatically.

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// The date column that tenure counts from: an explicit tenure source if set,
// else a date column whose label mentions "promot".
export function promotionDateFieldId(config) {
  const fields = config.roster.memberFields || [];
  const tenure = fields.find((f) => f.type === "tenure");
  if (tenure?.sourceFieldId) return tenure.sourceFieldId;
  return fields.find((f) => f.type === "date" && /promot/i.test(`${f.label} ${f.id}`))?.id || null;
}

// The text column holding callsigns (for auto-numbering on promotion).
export function callsignFieldId(config) {
  const fields = config.roster.memberFields || [];
  return fields.find((f) => f.type === "text" && /call\s?sign/i.test(`${f.label} ${f.id}`))?.id || null;
}

// Days since the member's tenure source date; null when not set/invalid.
export function tenureDays(member, field, fields) {
  const srcId =
    field.sourceFieldId ||
    fields.find((f) => f.type === "date" && /promot/i.test(`${f.label} ${f.id}`))?.id;
  const raw = srcId ? member.fields?.[srcId] : null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// Stamp a member's promotion date to today (no-op if no such column exists).
export function touchPromotionDate(config, subId, catId, memberId) {
  const fid = promotionDateFieldId(config);
  if (!fid) return config;
  return mapCategories(config, subId, (cats) =>
    cats.map((c) =>
      c.id !== catId
        ? c
        : {
            ...c,
            members: c.members.map((m) =>
              m.id === memberId
                ? { ...m, fields: { ...(m.fields || {}), [fid]: todayISO() } }
                : m
            ),
          }
    )
  );
}

// Move a member so they land directly before another member (row-level drop).
export function moveMemberBefore(config, subId, fromCatId, memberId, toCatId, beforeMemberId) {
  const sub = findSubdivision(config, subId);
  const toCat = (sub?.categories || []).find((c) => c.id === toCatId);
  if (!toCat) return config;
  let idx = toCat.members.findIndex((m) => m.id === beforeMemberId);
  if (idx === -1) return moveMember(config, subId, fromCatId, memberId, toCatId);
  if (fromCatId === toCatId) {
    const fromIdx = toCat.members.findIndex((m) => m.id === memberId);
    if (fromIdx !== -1 && fromIdx < idx) idx -= 1; // account for the strip-then-insert
  }
  return moveMember(config, subId, fromCatId, memberId, toCatId, idx);
}

// Yields callsigns from a format like "91##" (# runs become the lowest unused
// number, zero-padded). Returns null when exhausted or the format has no #.
function makeCallsignGenerator(format, used) {
  const m = /#+/.exec(format || "");
  if (!m) return null;
  const width = m[0].length;
  const max = 10 ** width;
  let n = 0;
  return () => {
    while (n < max) {
      const candidate = format.replace(/#+/, String(n).padStart(width, "0"));
      n++;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
    return null;
  };
}

/*
 * The mass promotion/demotion tool: assign `rankId` to every member in
 * `memberIds` (wherever they sit in the subdivision), stamp their promotion
 * date to today, and — if the target rank has a callsignFormat — hand each one
 * the next free callsign.
 */
export function applyPromotion(config, subId, memberIds, { rankId }) {
  const ids = new Set(memberIds);
  const sub = findSubdivision(config, subId);
  if (!sub || !rankId) return config;
  const rank = (sub.ranks || []).find((r) => r.id === rankId);
  const promoId = promotionDateFieldId(config);
  const csId = callsignFieldId(config);

  // Callsigns already taken in this subdivision (selected members give theirs up).
  const used = new Set();
  if (csId) {
    for (const c of sub.categories || []) {
      for (const m of c.members) {
        if (!ids.has(m.id) && m.fields?.[csId]) used.add(String(m.fields[csId]));
      }
    }
  }
  const nextCallsign = csId && rank?.callsignFormat ? makeCallsignGenerator(rank.callsignFormat, used) : null;

  return mapCategories(config, subId, (cats) =>
    cats.map((c) => ({
      ...c,
      members: c.members.map((m) => {
        if (!ids.has(m.id)) return m;
        const fields = { ...(m.fields || {}) };
        if (promoId) fields[promoId] = todayISO();
        if (nextCallsign) {
          const cs = nextCallsign();
          if (cs) fields[csId] = cs;
        }
        return { ...m, rank: rankId, fields };
      }),
    }))
  );
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
