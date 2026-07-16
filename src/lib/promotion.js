/*
 * Promotion eligibility — pure logic for the roster's "Promotion Eligibility
 * Checker". A member is eligible for their next rank when they clear every
 * enabled criterion: off probation, no active DA/strike, enough time in grade,
 * not on LOA, and not already at the top rank. All criteria are configurable
 * (config.roster.promoEligibility) with sensible defaults.
 *
 * DAs/strikes are read from admin-log entries (any logbook whose entry type
 * reads like discipline) within a recency window, and/or a member column that
 * tracks discipline directly. Probation / LOA / time-in-grade come from the
 * roster field helpers so this matches how the rest of the roster behaves.
 */
import {
  probationFieldId,
  isProbationActive,
  promotionDateFieldId,
  statusFieldId,
  isLoaValue,
} from "./roster.js";

export const DEFAULT_PROMO = {
  minDaysInGrade: 14, // days since last promotion required (0 = don't check)
  daWindowDays: 30, // a DA/strike this recent counts as active (0 = ever)
  requireOffProbation: true,
  excludeLoa: true,
  excludeTopRank: true,
};
export function promoSettings(config) {
  return { ...DEFAULT_PROMO, ...(config?.roster?.promoEligibility || {}) };
}

const DA_RE = /strike|\bda\b|coach|warn|suspend|demot|reprimand|discipl/i;
export const isDaType = (t) => DA_RE.test(String(t || ""));

// Every DA/strike admin-log entry across the site.
export function collectDAs(config) {
  const out = [];
  for (const p of config?.pages || []) {
    if (p.type !== "adminlog") continue;
    for (const e of p.config?.entries || []) if (isDaType(e.type)) out.push(e);
  }
  return out;
}

// Member columns that track discipline directly (a "Strikes"/"DA" column).
export function daFieldIds(config) {
  return (config?.roster?.memberFields || [])
    .filter((f) => /\bda\b|strike|discipl/i.test(`${f.label} ${f.id}`))
    .map((f) => ({ id: f.id, type: f.type }));
}
const daFieldActive = (type, v) => {
  if (v == null || v === "" || v === false) return false;
  if (type === "checkbox") return v === true;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "none" && s !== "n/a" && s !== "no" && s !== "false";
};

const DAY = 86400000;
const keyOf = (p) => (p?.discordId || "").trim() || (p?.name || "").trim().toLowerCase();

// Evaluate one member. Returns { eligible, reasons: [{key,label,detail?}], nextRankName }.
export function evaluateMember(config, sub, member, das, settings, now = Date.now()) {
  const s = settings;
  const reasons = [];
  const ranks = sub?.ranks || [];
  const idx = ranks.findIndex((r) => r.id === member.rank); // ranks are high→low
  const nextRankName =
    idx > 0 ? ranks[idx - 1].name : idx === 0 ? null : ranks.length ? ranks[ranks.length - 1].name : null;

  if (s.excludeTopRank && idx === 0) reasons.push({ key: "top", label: "At highest rank" });

  if (s.requireOffProbation) {
    const pid = probationFieldId(config);
    if (pid && isProbationActive(member.fields?.[pid]))
      reasons.push({ key: "prob", label: "On probation", detail: member.fields[pid] });
  }

  if (s.excludeLoa) {
    const sid = statusFieldId(config);
    if (sid && isLoaValue(member.fields?.[sid])) reasons.push({ key: "loa", label: "On LOA" });
  }

  // Active DA: a recent admin-log DA/strike, or a DA member column that's set.
  const mk = keyOf(member);
  const windowMs = s.daWindowDays > 0 ? s.daWindowDays * DAY : Infinity;
  const recent = mk
    ? das
        .filter((e) => keyOf(e.subject) === mk)
        .filter((e) => {
          const t = new Date(e.at || e.date).getTime();
          return Number.isNaN(t) ? true : now - t <= windowMs;
        })
    : [];
  const fieldDa = daFieldIds(config).some((f) => daFieldActive(f.type, member.fields?.[f.id]));
  if (recent.length || fieldDa) {
    const newest = recent.length
      ? recent.reduce((a, b) => (new Date(a.at || a.date) > new Date(b.at || b.date) ? a : b))
      : null;
    reasons.push({ key: "da", label: "Active DA", detail: newest ? newest.type : "on file" });
  }

  if (s.minDaysInGrade > 0) {
    const pid = promotionDateFieldId(config);
    const ds = pid ? member.fields?.[pid] : null;
    const t = ds ? new Date(ds).getTime() : NaN;
    if (!Number.isNaN(t)) {
      const days = Math.floor((now - t) / DAY);
      if (days < s.minDaysInGrade) reasons.push({ key: "tig", label: `${days}/${s.minDaysInGrade} days in grade` });
    }
  }

  return { eligible: reasons.length === 0, reasons, nextRankName };
}
