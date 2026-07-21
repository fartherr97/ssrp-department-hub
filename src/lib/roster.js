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

// A member's avatar is "auto" (safe to refresh from Discord) when it's empty or
// already a Discord CDN URL. A hand-entered custom URL is left alone.
function isAutoAvatar(url) {
  return !url || /cdn\.discordapp\.com\/(avatars|embed\/avatars)\//i.test(url);
}

// Update every roster member whose Discord ID matches to their current Discord
// avatar (called on login). Returns the same config object when nothing changed,
// so callers can skip a save. Custom (non-Discord) avatars are preserved.
export function applyDiscordAvatar(config, discordId, avatarUrl) {
  if (!config?.roster?.subdivisions || !discordId || !avatarUrl) return config;
  let changed = false;
  const subdivisions = config.roster.subdivisions.map((sub) => ({
    ...sub,
    categories: (sub.categories || []).map((cat) => ({
      ...cat,
      members: (cat.members || []).map((m) => {
        if (String(m.discordId) === String(discordId) && m.avatarUrl !== avatarUrl && isAutoAvatar(m.avatarUrl)) {
          changed = true;
          return { ...m, avatarUrl };
        }
        return m;
      }),
    })),
  }));
  return changed ? setSubdivisions(config, subdivisions) : config;
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
  // Never allow deleting the last subdivision, the roster must have one tab.
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
    ...(member.loa ? { loa: member.loa } : {}),
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
// "Time in grade" (a `tenure` column) is computed from a date column, usually
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

// Days since an auto column's source date; null when not set/invalid. Used by
// both auto column types: `tenure` (Time in Grade, counts from Date of
// Promotion) and `service` (Days in Service, counts from the hire/entry date
// and is never reset by promotions).
export function tenureDays(member, field, fields) {
  const auto = field.type === "service" ? /hire|entry|join|start/i : /promot/i;
  const srcId =
    field.sourceFieldId ||
    fields.find((f) => f.type === "date" && auto.test(`${f.label} ${f.id}`))?.id;
  const raw = srcId ? member.fields?.[srcId] : null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// What resets time in grade (stamps the promotion date): "category" moves,
// "rank" changes, "both", or "never". Set on the tenure column; defaults to
// category-change-only. Without a tenure column, both events stamp the date.
export function tenureResetOn(config) {
  const tenure = (config.roster.memberFields || []).find((f) => f.type === "tenure");
  if (!tenure) return "both";
  return ["rank", "category", "both", "never"].includes(tenure.resetOn)
    ? tenure.resetOn
    : "category";
}

export function tenureResetsOn(config, kind) {
  const v = tenureResetOn(config);
  return v === "both" || v === kind;
}

// Like touchPromotionDate, but for *category* moves, respects the tenure
// column's "resets when" setting.
export function touchPromotionDateOnCategoryChange(config, subId, catId, memberId) {
  if (!tenureResetsOn(config, "category")) return config;
  return touchPromotionDate(config, subId, catId, memberId);
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
 * date to today, and, if the target rank has a callsignFormat, hand each one
 * the next free callsign.
 */
export function applyPromotion(config, subId, memberIds, { rankId, probationUntil = "", callsignFormat = "" }) {
  const ids = new Set(memberIds);
  const sub = findSubdivision(config, subId);
  if (!sub || !rankId) return config;
  const rank = (sub.ranks || []).find((r) => r.id === rankId);
  const promoId = promotionDateFieldId(config);
  const csId = callsignFieldId(config);
  const probId = probationUntil ? probationFieldId(config) : null;

  // Callsigns already taken in this subdivision (selected members give theirs up).
  const used = new Set();
  if (csId) {
    for (const c of sub.categories || []) {
      for (const m of c.members) {
        if (!ids.has(m.id) && m.fields?.[csId]) used.add(String(m.fields[csId]));
      }
    }
  }
  // An explicit callsign series (e.g. "96##") overrides the rank's own format.
  const format = callsignFormat || rank?.callsignFormat;
  const nextCallsign = csId && format ? makeCallsignGenerator(format, used) : null;

  return mapCategories(config, subId, (cats) =>
    cats.map((c) => ({
      ...c,
      members: c.members.map((m) => {
        if (!ids.has(m.id)) return m;
        const fields = { ...(m.fields || {}) };
        if (promoId && tenureResetsOn(config, "rank")) fields[promoId] = todayISO();
        if (probId) fields[probId] = probationUntil;
        if (nextCallsign) {
          const cs = nextCallsign();
          if (cs) fields[csId] = cs;
        }
        return { ...m, rank: rankId, fields };
      }),
    }))
  );
}

// ── Column auto-detection (probation / hire date / status / notes) ──────────

export function probationFieldId(config) {
  return (config.roster.memberFields || []).find(
    (f) => f.type === "date" && /probation/i.test(`${f.label} ${f.id}`)
  )?.id || null;
}

export function hireDateFieldId(config) {
  return (config.roster.memberFields || []).find(
    (f) => f.type === "date" && /hire|entry|join|start/i.test(`${f.label} ${f.id}`)
  )?.id || null;
}

export function statusFieldId(config) {
  const fields = config.roster.memberFields || [];
  return (
    fields.find((f) => f.type === "select" && /status|activity/i.test(`${f.label} ${f.id}`)) ||
    fields.find((f) => f.type === "select")
  )?.id || null;
}

export function notesFieldId(config) {
  return (config.roster.memberFields || []).find(
    (f) => f.type === "text" && /note/i.test(`${f.label} ${f.id}`)
  )?.id || null;
}

export const isLoaValue = (v) => /loa|leave/i.test(String(v || ""));

// ── Disciplinary auto-probation ─────────────────────────────────────────────
// config.discipline.autoProbation = [{ id, match, days }]. When a disciplinary
// log entry whose `type` contains `match` (case-insensitive) is filed for a
// member (matched by discordId), their probation column is set to today + days.
// A passed probation date is treated as inactive at render time, so it "comes
// off" the profile automatically with no cleanup job.

export function probationDaysForType(config, type) {
  const rules = config?.discipline?.autoProbation || [];
  const t = String(type || "").toLowerCase();
  let best = 0;
  for (const r of rules) {
    const m = String(r.match || "").trim().toLowerCase();
    const days = Number(r.days) || 0;
    if (m && days > 0 && t.includes(m)) best = Math.max(best, days);
  }
  return best;
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

// Set probation on whichever member matches discordId (across all subdivisions).
export function applyAutoProbation(config, discordId, days) {
  const probId = probationFieldId(config);
  if (!probId || !discordId || !(Number(days) > 0)) return config;
  const until = addDaysISO(days);
  let touched = false;
  const subdivisions = (config.roster?.subdivisions || []).map((s) => ({
    ...s,
    categories: (s.categories || []).map((c) => ({
      ...c,
      members: (c.members || []).map((m) => {
        if (String(m.discordId || "") !== String(discordId)) return m;
        touched = true;
        return { ...m, fields: { ...(m.fields || {}), [probId]: until } };
      }),
    })),
  }));
  if (!touched) return config;
  return { ...config, roster: { ...config.roster, subdivisions } };
}

// Is a probation date still active (today or later)? Past dates auto-expire.
export function isProbationActive(value) {
  if (!value) return false;
  return String(value).slice(0, 10) >= new Date().toISOString().slice(0, 10);
}

// The next free callsign for a given format (e.g. "96##") in a subdivision.
export function nextCallsignForFormat(config, subId, format) {
  const csId = callsignFieldId(config);
  const sub = findSubdivision(config, subId);
  if (!csId || !format || !sub) return null;
  const used = new Set();
  for (const c of sub.categories || []) {
    for (const m of c.members) if (m.fields?.[csId]) used.add(String(m.fields[csId]));
  }
  return makeCallsignGenerator(format, used)?.() ?? null;
}

// The next free callsign for a rank's format (or null), used when hiring.
export function nextCallsignFor(config, subId, rankId) {
  const sub = findSubdivision(config, subId);
  const rank = (sub?.ranks || []).find((r) => r.id === rankId);
  return rank?.callsignFormat ? nextCallsignForFormat(config, subId, rank.callsignFormat) : null;
}

// ── LOA bookkeeping ──────────────────────────────────────────────────────────
// Going on LOA stores the return date + prior status on the member and writes
// a structured note into the notes column (if one exists); coming off LOA
// removes both. The note pattern is ours, so we can strip it cleanly.

const LOA_NOTE = /\s*\[LOA until [^\]]*\]/g;

export function withLoaTransition(config, member, prevFields = member.fields || {}) {
  const statusId = statusFieldId(config);
  if (!statusId) return member;
  const notesId = notesFieldId(config);
  const fields = { ...(member.fields || {}) };
  const nowLoa = isLoaValue(fields[statusId]);
  const wasLoa = isLoaValue(prevFields[statusId]);
  let next = { ...member, fields };

  if (notesId) fields[notesId] = String(fields[notesId] || "").replace(LOA_NOTE, "").trim();

  if (nowLoa) {
    const loa = {
      returnDate: member.loa?.returnDate || "",
      prev: wasLoa ? member.loa?.prev || "" : prevFields[statusId] || "",
    };
    next.loa = loa;
    if (notesId) {
      const until = loa.returnDate || "Indefinite";
      const prior = loa.prev ? ` | Prior: ${loa.prev}` : "";
      fields[notesId] = `${fields[notesId] ? fields[notesId] + " " : ""}[LOA until ${until}${prior}]`;
    }
  } else if (next.loa) {
    const { loa, ...rest } = next;
    next = rest;
  }
  return next;
}

// ── Bulk actions (operate on selected members within one subdivision) ───────

export function bulkSetFields(config, subId, memberIds, patch) {
  const ids = new Set(memberIds);
  return mapCategories(config, subId, (cats) =>
    cats.map((c) => ({
      ...c,
      members: c.members.map((m) =>
        ids.has(m.id) ? { ...m, fields: { ...(m.fields || {}), ...patch } } : m
      ),
    }))
  );
}

export function bulkSetStatus(config, subId, memberIds, value) {
  const statusId = statusFieldId(config);
  if (!statusId) return config;
  const ids = new Set(memberIds);
  return mapCategories(config, subId, (cats) =>
    cats.map((c) => ({
      ...c,
      members: c.members.map((m) => {
        if (!ids.has(m.id)) return m;
        const prevFields = m.fields || {};
        return withLoaTransition(
          config,
          { ...m, fields: { ...prevFields, [statusId]: value } },
          prevFields
        );
      }),
    }))
  );
}

// ── Terminations ─────────────────────────────────────────────────────────────
// "Fire" removes the person from EVERY subdivision (matched by Discord ID when
// set, else just that entry) and archives a snapshot so Overturn/reinstate can
// restore name, rank, fields, and subdivision memberships.

const TERMINATION_LIMIT = 300;

export function terminateMember(config, memberId, { by = "" } = {}) {
  let target = null;
  for (const sub of config.roster.subdivisions || []) {
    for (const cat of sub.categories || []) {
      const hit = cat.members.find((m) => m.id === memberId);
      if (hit) target = hit;
    }
  }
  if (!target) return config;
  const matches = (m) =>
    m.id === memberId || (target.discordId && m.discordId === target.discordId);

  const entries = [];
  const subdivisions = (config.roster.subdivisions || []).map((sub) => ({
    ...sub,
    categories: (sub.categories || []).map((cat) => ({
      ...cat,
      members: cat.members.filter((m) => {
        if (!matches(m)) return true;
        entries.push({ subId: sub.id, subName: sub.name, catId: cat.id, catName: cat.name, member: m });
        return false;
      }),
    })),
  }));
  if (!entries.length) return config;

  const record = {
    id: uid("term"),
    name: target.name || "Unknown",
    discordId: target.discordId || "",
    at: new Date().toISOString(),
    by,
    entries,
  };
  const terminations = [record, ...(config.roster.terminations || [])].slice(0, TERMINATION_LIMIT);
  return { ...config, roster: { ...config.roster, subdivisions, terminations } };
}

// Overturn: put every archived entry back (falling back to the subdivision's
// first category, or skipping subdivisions that no longer exist).
export function reinstateTermination(config, recordId) {
  const record = (config.roster.terminations || []).find((r) => r.id === recordId);
  if (!record) return config;
  let next = config;
  for (const entry of record.entries || []) {
    const sub = findSubdivision(next, entry.subId);
    if (!sub) continue;
    const cat =
      (sub.categories || []).find((c) => c.id === entry.catId) || (sub.categories || [])[0];
    if (!cat) continue;
    next = mapCategories(next, sub.id, (cats) =>
      cats.map((c) =>
        c.id === cat.id ? { ...c, members: [...c.members, entry.member] } : c
      )
    );
  }
  return {
    ...next,
    roster: {
      ...next.roster,
      terminations: (next.roster.terminations || []).filter((r) => r.id !== recordId),
    },
  };
}

export function deleteTermination(config, recordId) {
  return {
    ...config,
    roster: {
      ...config.roster,
      terminations: (config.roster.terminations || []).filter((r) => r.id !== recordId),
    },
  };
}

/*
 * Discord rank sync. Ranks can carry a `discordRoleId`; when the backend's
 * Discord bot reports a member's current roles, this maps them to ranks and
 * updates the member everywhere they appear on the roster. Within a
 * subdivision, ranks are ordered highest-first, so the first rank whose
 * Discord role the member holds wins. Rank changes go through applyPromotion,
 * so promotion-date stamping and callsign formats behave exactly like a
 * manual promotion. Returns the (possibly unchanged) config.
 */
export function syncMemberRanksFromDiscord(config, discordId, roleIds) {
  if (!discordId) return config;
  const roles = new Set((roleIds || []).map(String));
  let next = config;
  for (const sub of config.roster.subdivisions || []) {
    const target = (sub.ranks || []).find(
      (r) => r.discordRoleId && roles.has(String(r.discordRoleId))
    );
    if (!target) continue;
    for (const cat of sub.categories || []) {
      for (const m of cat.members) {
        if (m.discordId && String(m.discordId) === String(discordId) && m.rank !== target.id) {
          next = applyPromotion(next, sub.id, [m.id], { rankId: target.id });
        }
      }
    }
  }
  return next;
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
