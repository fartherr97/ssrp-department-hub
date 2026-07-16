/*
 * Promotion Board — pure logic for the "promotion" page type. Staff nominate a
 * member for a rank, a timed vote opens (approve / deny / abstain with a reason),
 * and the result passes when approval clears a threshold. Votes stay anonymous to
 * regular viewers until they close or are published; managers always see the
 * ballots. Data lives on the page config: { votes: [vote], rankColors: {} }.
 *
 *   vote: { id, name, discordId, currentRank, proposedRank, reason,
 *           createdBy:{name,discordId}, createdAt, opensAt, closesAt,
 *           status?: "cancelled", published?: bool, publishedAt?,
 *           ballots: [{ voter:{name,discordId}, choice, reason, at }] }
 */
import { canManageSite, userLevel, groupLevel } from "./permissions.js";

let _seq = 0;
export function boardId(p) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${p}-${crypto.randomUUID().slice(0, 8)}`;
  return `${p}-${(_seq++).toString(36)}-${Date.now().toString(36)}`;
}

export const DEFAULT_VOTE_HOURS = 72;
export const APPROVAL_THRESHOLD = 50; // % approve of decisive (non-abstain) votes to pass

export const VOTE_STATUSES = [
  { id: "pending", label: "Pending", color: "#f59e0b" },
  { id: "approved", label: "Approved", color: "#1eb854" },
  { id: "denied", label: "Closed - Denied", color: "#ef4444" },
  { id: "published", label: "Published", color: "#3b82f6" },
  { id: "cancelled", label: "Cancelled", color: "#64748b" },
];
export const statusMeta = (id) => VOTE_STATUSES.find((s) => s.id === id) || VOTE_STATUSES[0];
export const CHOICES = [
  { id: "approve", label: "Approve", color: "#1eb854" },
  { id: "deny", label: "Deny", color: "#ef4444" },
  { id: "abstain", label: "Abstain", color: "#f59e0b" },
];

export function tally(vote) {
  const bs = vote?.ballots || [];
  const approve = bs.filter((b) => b.choice === "approve").length;
  const deny = bs.filter((b) => b.choice === "deny").length;
  const abstain = bs.filter((b) => b.choice === "abstain").length;
  const decisive = approve + deny;
  const approval = decisive ? Math.round((approve / decisive) * 100) : 0;
  const passing = decisive > 0 && approval >= APPROVAL_THRESHOLD;
  return { approve, deny, abstain, total: bs.length, decisive, approval, passing };
}

export function voteStatus(vote, now = Date.now()) {
  if (vote?.status === "cancelled") return "cancelled";
  if (vote?.published) return "published";
  const closes = new Date(vote?.closesAt).getTime();
  if (!Number.isNaN(closes) && now < closes) return "pending";
  return tally(vote).passing ? "approved" : "denied";
}
export const isOpen = (vote, now = Date.now()) => voteStatus(vote, now) === "pending";

const keyOf = (u) => String(u?.discordId || u?.id || "");
export function myBallot(vote, user) {
  const k = keyOf(user);
  return k ? (vote?.ballots || []).find((b) => keyOf(b.voter) === k) || null : null;
}

export function canManageBoard(user, config) {
  return canManageSite(user, config);
}

// ── Result-visibility gating (anti-bandwagon) ────────────────────────────────
// Live tallies + ballots stay hidden until a vote is *published*, so members
// vote blind and can't pile onto the leader. Exceptions: site managers always
// see live, and configurable rules grant a group live sight of votes up to a
// rank ceiling. rules: [{ groupId, maxRank }] — that group AND ABOVE may see
// live results of votes whose proposed rank is at/below maxRank (blank = all).

// Seniority index of a rank name (0 = most senior; Infinity if unknown).
export function rankSeniority(config, rankName) {
  if (!rankName) return Infinity;
  let best = Infinity;
  for (const sub of config?.roster?.subdivisions || []) {
    const idx = (sub.ranks || []).findIndex((r) => r.name === rankName);
    if (idx >= 0) best = Math.min(best, idx);
  }
  return best;
}

// The most-senior rank index a user may see live, or null for no access.
// -1 means "all ranks".
export function liveCeiling(user, config, rules) {
  if (!user) return null;
  const ul = userLevel(user, config);
  let ceiling = null;
  for (const rule of rules || []) {
    if (ul < groupLevel(config, rule.groupId)) continue;
    const idx = !rule.maxRank || rule.maxRank === "__all" ? -1 : rankSeniority(config, rule.maxRank);
    ceiling = ceiling === null ? idx : Math.min(ceiling, idx);
  }
  return ceiling;
}

// Can this user see the live tally + ballots for this vote (before publish)?
export function canSeeResults(user, config, vote, rules) {
  if (canManageSite(user, config)) return true;
  if (vote?.published) return true;
  const ceiling = liveCeiling(user, config, rules);
  if (ceiling === null) return false;
  if (ceiling === -1) return true;
  return rankSeniority(config, vote?.proposedRank) >= ceiling;
}

// The status a user is allowed to see. Without result access, an unpublished
// vote reads "pending" (its outcome stays hidden even after it closes).
export function publicStatus(user, config, vote, rules, now = Date.now()) {
  if (canSeeResults(user, config, vote, rules)) return voteStatus(vote, now);
  if (vote?.status === "cancelled") return "cancelled";
  if (vote?.published) return "published";
  return "pending";
}

export function boardStats(votes, now = Date.now()) {
  const s = { pending: 0, approved: 0, denied: 0, published: 0, cancelled: 0, total: (votes || []).length };
  for (const v of votes || []) s[voteStatus(v, now)] += 1;
  return s;
}

// "2d 3h 9m 48s" until close, or "Closed".
export function countdown(closesAt, now = Date.now()) {
  let ms = new Date(closesAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "Closed";
  const d = Math.floor(ms / 86400000); ms -= d * 86400000;
  const h = Math.floor(ms / 3600000); ms -= h * 3600000;
  const m = Math.floor(ms / 60000); ms -= m * 60000;
  const sec = Math.floor(ms / 1000);
  return [d ? `${d}d` : null, `${h}h`, `${m}m`, `${sec}s`].filter(Boolean).join(" ");
}

// Unique rank names across every subdivision, in listed order.
export function allRankNames(config) {
  const seen = new Set();
  const out = [];
  for (const sub of config?.roster?.subdivisions || []) {
    for (const r of sub.ranks || []) {
      if (r.name && !seen.has(r.name)) { seen.add(r.name); out.push(r.name); }
    }
  }
  return out;
}

export function newVote({ name, discordId, currentRank, proposedRank, reason, createdBy, hours = DEFAULT_VOTE_HOURS, now = Date.now() }) {
  const opensAt = new Date(now).toISOString();
  const closesAt = new Date(now + hours * 3600000).toISOString();
  return {
    id: boardId("vote"),
    name: String(name || "").trim(),
    discordId: String(discordId || "").trim(),
    currentRank: currentRank || "",
    proposedRank: proposedRank || "",
    reason: String(reason || "").trim(),
    createdBy,
    createdAt: opensAt,
    opensAt,
    closesAt,
    ballots: [],
  };
}
