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
  minWeekHours: 0, // on-duty hours required this week (0 = don't check)
  minMonthHours: 0, // on-duty hours required this month (0 = don't check)
  requireOffProbation: true,
  excludeLoa: true,
  excludeTopRank: true,
};
const hrs = (n) => (n % 1 ? (Math.round(n * 10) / 10).toFixed(1) : String(n));
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

// The value of the first active DA member column, to show as the reason detail
// (e.g. a "Strikes" column reading "Strike I"). null when no DA column is set.
function activeDaValue(config, member) {
  const fields = config?.roster?.memberFields || [];
  for (const f of daFieldIds(config)) {
    const v = member.fields?.[f.id];
    if (!daFieldActive(f.type, v)) continue;
    if (f.type === "checkbox") return fields.find((x) => x.id === f.id)?.label || "on file";
    return String(v).trim();
  }
  return null;
}

const DAY = 86400000;
const keyOf = (p) => (p?.discordId || "").trim() || (p?.name || "").trim().toLowerCase();

// Evaluate one member. `hours` is a Map(discordId → {weekHours, monthHours}) or
// null when the activity feed hasn't loaded (then activity is skipped, never a
// false negative). Returns { eligible, reasons: [{key,label,detail?}], nextRankName }.
export function evaluateMember(config, sub, member, das, hours, settings, now = Date.now()) {
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
  const fieldDa = activeDaValue(config, member); // string value, or null
  if (recent.length || fieldDa != null) {
    const newest = recent.length
      ? recent.reduce((a, b) => (new Date(a.at || a.date) > new Date(b.at || b.date) ? a : b))
      : null;
    reasons.push({ key: "da", label: "Active DA", detail: newest ? newest.type : fieldDa || "on file" });
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

  // Activity — on-duty hours from the Duty Hub feed. Only checked once the feed
  // has loaded (hours != null) so a slow/absent feed never fails anyone falsely.
  if (hours && (s.minWeekHours > 0 || s.minMonthHours > 0)) {
    const h = hours.get(String(member.discordId || "")) || { weekHours: 0, monthHours: 0 };
    if (s.minWeekHours > 0 && h.weekHours < s.minWeekHours)
      reasons.push({ key: "hoursWk", label: `${hrs(h.weekHours)}/${hrs(s.minWeekHours)}h this week` });
    if (s.minMonthHours > 0 && h.monthHours < s.minMonthHours)
      reasons.push({ key: "hoursMo", label: `${hrs(h.monthHours)}/${hrs(s.minMonthHours)}h this month` });
  }

  return { eligible: reasons.length === 0, reasons, nextRankName };
}
