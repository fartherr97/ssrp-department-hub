/*
 * Audit log. Records who changed what (and when) by diffing the config at each
 * save. The actor is the signed-in user (Discord name + id). Entries are stored
 * through the data layer (localStorage today, an /api/audit table later), so the
 * Audit Log page and the rest of the app stay decoupled from how it's persisted.
 */
import * as api from "./api.js";

let currentActor = null;

// App sets this whenever the session changes so the recorder knows who's acting.
export function setActor(user) {
  currentActor = user
    ? { name: user.username || user.name || "Unknown", discordId: user.id || "", group: user.group || "" }
    : null;
}

const j = (v) => JSON.stringify(v);
const byId = (arr) => new Map((arr || []).map((x) => [x.id, x]));

function flattenMembers(config) {
  const map = new Map();
  for (const sub of config?.roster?.subdivisions || []) {
    for (const cat of sub.categories || []) {
      for (const m of cat.members || []) {
        map.set(m.id, { m, subName: sub.name, catName: cat.name, catId: cat.id });
      }
    }
  }
  return map;
}

function changedTopSections(prev, next) {
  const keys = ["roster", "branding", "pages", "groups", "auth", "navGroups", "dropdownGroups"];
  return keys.filter((k) => j(prev?.[k]) !== j(next?.[k]));
}

function brandingDetail(prev, next) {
  const keys = Object.keys({ ...(prev || {}), ...(next || {}) }).filter(
    (k) => j(prev?.[k]) !== j(next?.[k])
  );
  if (!keys.length) return "";
  const labels = keys.map((k) =>
    k === "colors" ? "theme colors" : k.replace(/([A-Z])/g, " $1").toLowerCase()
  );
  return `, ${labels.slice(0, 3).join(", ")}`;
}

function summarizeRoster(prev, next) {
  const pm = flattenMembers(prev);
  const nm = flattenMembers(next);
  const added = [...nm.keys()].filter((id) => !pm.has(id));
  const removed = [...pm.keys()].filter((id) => !nm.has(id));
  if (added.length === 1 && !removed.length) {
    const e = nm.get(added[0]);
    return { category: "roster", action: `Added ${e.m.name || "a member"} to ${e.catName} · ${e.subName}` };
  }
  if (removed.length === 1 && !added.length) {
    const e = pm.get(removed[0]);
    return { category: "roster", action: `Removed ${e.m.name || "a member"} from ${e.catName} · ${e.subName}` };
  }
  if (added.length || removed.length) {
    return { category: "roster", action: `Roster members changed (+${added.length} / −${removed.length})` };
  }
  // moved / edited members
  for (const [id, n] of nm) {
    const p = pm.get(id);
    if (!p) continue;
    if (p.catId !== n.catId) {
      return { category: "roster", action: `Moved ${n.m.name || "a member"} to ${n.catName} · ${n.subName}` };
    }
    if (j(p.m) !== j(n.m)) {
      return { category: "roster", action: `Edited ${n.m.name || "a member"} · ${n.subName}` };
    }
  }
  // structure: subdivisions / categories / ranks / appearance
  const ps = byId(prev.roster?.subdivisions);
  const ns = byId(next.roster?.subdivisions);
  const sAdded = [...ns.keys()].filter((id) => !ps.has(id));
  const sRemoved = [...ps.keys()].filter((id) => !ns.has(id));
  if (sAdded.length) return { category: "roster", action: `Added subdivision "${ns.get(sAdded[0]).name}"` };
  if (sRemoved.length) return { category: "roster", action: `Deleted subdivision "${ps.get(sRemoved[0]).name}"` };
  for (const [id, nsub] of ns) {
    const psub = ps.get(id);
    if (!psub) continue;
    const pc = byId(psub.categories);
    const nc = byId(nsub.categories);
    const cAdded = [...nc.keys()].filter((x) => !pc.has(x));
    const cRemoved = [...pc.keys()].filter((x) => !nc.has(x));
    if (cAdded.length) return { category: "roster", action: `Added category "${nc.get(cAdded[0]).name}" to ${nsub.name}` };
    if (cRemoved.length) return { category: "roster", action: `Deleted category "${pc.get(cRemoved[0]).name}" from ${nsub.name}` };
    for (const [cid, ncat] of nc) {
      const pcat = pc.get(cid);
      if (pcat && pcat.name !== ncat.name) {
        return { category: "roster", action: `Renamed a category to "${ncat.name}" in ${nsub.name}` };
      }
    }
    const pr = byId(psub.ranks);
    const nr = byId(nsub.ranks);
    const rAdded = [...nr.keys()].filter((x) => !pr.has(x));
    const rRemoved = [...pr.keys()].filter((x) => !nr.has(x));
    if (rAdded.length) return { category: "roster", action: `Added rank "${nr.get(rAdded[0]).name}" to ${nsub.name}` };
    if (rRemoved.length) return { category: "roster", action: `Deleted rank "${pr.get(rRemoved[0]).name}" from ${nsub.name}` };
    if (j(psub.ranks) !== j(nsub.ranks)) return { category: "roster", action: `Updated ranks in ${nsub.name}` };
    if (psub.name !== nsub.name) return { category: "roster", action: `Renamed subdivision to "${nsub.name}"` };
    if (j(psub.banner) !== j(nsub.banner) || psub.accent !== nsub.accent) {
      return { category: "roster", action: `Updated ${nsub.name} appearance` };
    }
  }
  if (j(prev.roster?.memberFields) !== j(next.roster?.memberFields)) {
    return { category: "roster", action: "Updated roster columns" };
  }
  if (j(prev.roster?.stats) !== j(next.roster?.stats)) return { category: "roster", action: "Updated roster stats" };
  if (prev.roster?.layout !== next.roster?.layout) {
    return { category: "roster", action: `Changed roster layout to ${next.roster?.layout}` };
  }
  return { category: "roster", action: "Updated the roster" };
}

// Detect calendar event add/edit/remove so the activity feed reads naturally,
// instead of a generic "Edited page". Events live in a calendar page's config.
function summarizeCalendar(prev, next) {
  for (const np of (next || []).filter((p) => p.type === "calendar")) {
    const pp = (prev || []).find((p) => p.id === np.id);
    if (!pp) continue;
    const pe = byId(pp.config?.events || []);
    const ne = byId(np.config?.events || []);
    const added = [...ne.keys()].filter((id) => !pe.has(id));
    const removed = [...pe.keys()].filter((id) => !ne.has(id));
    const title = (e) => `"${e?.title || "Untitled"}"`;
    if (added.length === 1 && !removed.length)
      return { category: "calendar", action: `Added event ${title(ne.get(added[0]))}` };
    if (removed.length === 1 && !added.length)
      return { category: "calendar", action: `Removed event ${title(pe.get(removed[0]))}` };
    if (added.length || removed.length)
      return { category: "calendar", action: `Calendar events changed (+${added.length} / −${removed.length})` };
    for (const [id, ev] of ne) {
      const old = pe.get(id);
      if (old && j(old) !== j(ev)) return { category: "calendar", action: `Updated event ${title(ev)}` };
    }
  }
  return null;
}

// Detect exam submission changes (new submissions, re-grades, trash/restore) so
// grading activity reads naturally in the log instead of a generic "Edited page".
// Submissions live on an exam-center page's config.
function summarizeSubmissions(prev, next) {
  for (const np of (next || [])) {
    const pp = (prev || []).find((p) => p.id === np.id);
    if (!pp) continue;
    const ps = byId(pp.config?.submissions || []);
    const ns = byId(np.config?.submissions || []);
    if (!ps.size && !ns.size) continue;
    const added = [...ns.keys()].filter((id) => !ps.has(id));
    const removed = [...ps.keys()].filter((id) => !ns.has(id));
    const who = (s) => s?.subject?.name || "Anonymous";
    const title = (s) => `"${s?.examTitle || "a form"}"`;
    if (added.length === 1 && !removed.length) {
      const s = ns.get(added[0]);
      return { category: "exams", action: `New ${title(s)} submission from ${who(s)}` };
    }
    if (removed.length === 1 && !added.length) {
      const s = ps.get(removed[0]);
      return { category: "exams", action: `Permanently deleted a ${title(s)} submission` };
    }
    for (const [id, n] of ns) {
      const p = ps.get(id);
      if (!p) continue;
      if (!!p.deleted !== !!n.deleted) {
        return { category: "exams", action: n.deleted ? `Moved a ${title(n)} submission to the recycle bin` : `Restored a ${title(n)} submission` };
      }
      const gradeChanged = j(p.graded) !== j(n.graded) || p.score !== n.score || p.status !== n.status;
      if (gradeChanged) {
        const pct = (s) => (s?.maxScore ? `${s.percent}%` : "no score");
        const verb = p.status === "needs-review" ? "Reviewed & graded" : "Re-graded";
        return { category: "exams", action: `${verb} ${who(n)}'s ${title(n)} submission (${pct(p)} → ${pct(n)})` };
      }
    }
  }
  return null;
}

function summarizePages(prev, next) {
  const cal = summarizeCalendar(prev, next);
  if (cal) return cal;
  const subm = summarizeSubmissions(prev, next);
  if (subm) return subm;
  const pp = byId(prev);
  const np = byId(next);
  const added = [...np.keys()].filter((id) => !pp.has(id));
  const removed = [...pp.keys()].filter((id) => !np.has(id));
  if (added.length) return { category: "pages", action: `Added page "${np.get(added[0]).label}"` };
  if (removed.length) return { category: "pages", action: `Deleted page "${pp.get(removed[0]).label}"` };
  for (const [id, n] of np) {
    const p = pp.get(id);
    if (!p) continue;
    if (j(p.access) !== j(n.access)) return { category: "access", action: `Changed who can view "${n.label}"` };
    if (j(p) !== j(n)) return { category: "pages", action: `Edited page "${n.label}"` };
  }
  return { category: "pages", action: "Updated pages" };
}

function summarizeGroups(prev, next) {
  const pg = byId(prev);
  const ng = byId(next);
  const added = [...ng.keys()].filter((id) => !pg.has(id));
  const removed = [...pg.keys()].filter((id) => !ng.has(id));
  if (added.length) return { category: "access", action: `Created group "${ng.get(added[0]).label}"` };
  if (removed.length) return { category: "access", action: `Deleted group "${pg.get(removed[0]).label}"` };
  for (const [id, n] of ng) {
    const p = pg.get(id);
    if (!p) continue;
    const pm = byId(p.members || []);
    const nm = byId(n.members || []);
    const mAdded = [...nm.keys()].filter((x) => !pm.has(x));
    const mRemoved = [...pm.keys()].filter((x) => !nm.has(x));
    if (mAdded.length) return { category: "access", action: `Assigned ${nm.get(mAdded[0]).name || "someone"} to "${n.label}"` };
    if (mRemoved.length) return { category: "access", action: `Removed ${pm.get(mRemoved[0]).name || "someone"} from "${n.label}"` };
    const caps = ["manageSite", "manageAccess", "editRoster", "editSubdivisions", "manageCalendar"];
    if (caps.some((c) => p[c] !== n[c]) || p.level !== n.level) {
      return { category: "access", action: `Changed "${n.label}" permissions` };
    }
    if (p.label !== n.label) return { category: "access", action: `Renamed a group to "${n.label}"` };
  }
  return { category: "access", action: "Updated groups" };
}

// Produce a single { category, action } describing the net change, or null.
export function summarizeChange(prev, next) {
  if (!prev || !next) return null;
  const sections = changedTopSections(prev, next);
  if (sections.length === 0) return null;
  if (sections.length >= 3) {
    return { category: "config", action: "Replaced the configuration (import or bulk change)" };
  }
  if (j(prev.roster) !== j(next.roster)) {
    const r = summarizeRoster(prev, next);
    if (r) return r;
  }
  if (j(prev.branding) !== j(next.branding)) {
    return { category: "branding", action: `Updated branding${brandingDetail(prev.branding, next.branding)}` };
  }
  if (j(prev.pages) !== j(next.pages)) {
    const p = summarizePages(prev.pages, next.pages);
    if (p) return p;
  }
  if (j(prev.groups) !== j(next.groups)) {
    const g = summarizeGroups(prev.groups, next.groups);
    if (g) return g;
  }
  if (j(prev.auth) !== j(next.auth)) {
    return { category: "access", action: "Updated Discord sign-in settings" };
  }
  if (j(prev.navGroups) !== j(next.navGroups) || j(prev.dropdownGroups) !== j(next.dropdownGroups)) {
    return { category: "pages", action: "Updated navigation" };
  }
  return null;
}

function entryFrom(summary) {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    actor: currentActor,
    ...summary,
  };
}

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("audit:changed"));
}

// Diff two configs and, if something meaningful changed, append an entry.
export async function recordChange(prev, next) {
  let summary = null;
  try {
    summary = summarizeChange(prev, next);
  } catch {
    summary = null;
  }
  if (!summary) return;
  const entry = entryFrom(summary);
  // Record the human-readable log entry and the restorable snapshot separately,
  // so a failure on one doesn't silently drop the other — and log any failure so
  // an empty history is diagnosable instead of mysterious.
  try {
    await api.appendAuditLog(entry);
  } catch (e) {
    console.warn("[audit] could not save log entry:", e?.message || e);
  }
  try {
    await api.pushVersion({
      id: entry.id,
      ts: entry.ts,
      actor: entry.actor,
      category: entry.category,
      action: entry.action,
      config: next,
    });
  } catch (e) {
    console.warn("[audit] could not save version snapshot:", e?.message || e);
  }
  notifyChanged();
}

export function getVersions() {
  return api.getVersions();
}

// Log an explicit event (e.g. a reset) that isn't a simple diff.
export async function logEvent(category, action) {
  try {
    await api.appendAuditLog(entryFrom({ category, action }));
    notifyChanged();
  } catch {
    /* ignore */
  }
}

export function getLog() {
  return api.getAuditLog();
}
