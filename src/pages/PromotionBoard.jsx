import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, X, Clock, CircleCheck, CircleX, FileText, TrendingUp, ThumbsUp,
  ThumbsDown, MinusCircle, ArrowRight, Palette, ShieldCheck, Users2, Activity, Trash2, Lock, Eye,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canManageSite } from "../lib/permissions.js";
import * as api from "../lib/api.js";
import { promoWebhook, sendPromotionWebhook } from "../lib/webhooks.js";
import { getPagePath } from "../lib/navigation.js";
import {
  Panel, PageHeader, Button, IconButton, Field, Input, Select, Textarea, Badge,
  EmptyState, Modal, ConfirmDialog, useModalData, Toast,
} from "../components/common/index.jsx";
import {
  tally, voteStatus, myBallot, countdown, newVote, allRankNames,
  statusMeta, CHOICES, boardId, DEFAULT_VOTE_HOURS,
  canSeeResults, publicStatus,
} from "../lib/promotionBoard.js";

const who = (u) => u?.displayName || u?.username || "Unknown";
const initials = (name) => {
  const seg = String(name || "").split("|").pop().trim() || String(name || "");
  const w = seg.split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : seg.slice(0, 2) || "?").toUpperCase();
};
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

// A ticking clock so countdowns update live.
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

function Avatar({ name, className = "h-9 w-9" }) {
  return <span className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-300`}>{initials(name)}</span>;
}
function StatusPill({ s }) { const m = statusMeta(s); return <Badge color={m.color}>{m.label}</Badge>; }
function RankPill({ name, colors, kind }) {
  if (!name) return <span className="text-xs text-slate-500">—</span>;
  const color = colors?.[name] || (kind === "proposed" ? "var(--color-primary)" : "#94a3b8");
  return <span className="rounded-md border px-2 py-0.5 text-xs font-bold" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{name}</span>;
}
function PromoPath({ vote, colors }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankPill name={vote.currentRank} colors={colors} kind="current" />
      <ArrowRight size={12} className="text-slate-500" />
      <RankPill name={vote.proposedRank} colors={colors} kind="proposed" />
    </span>
  );
}
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Panel className="p-4" style={{ borderTop: `2px solid ${color || "var(--color-primary)"}` }}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">{label}</div>
        {Icon && <Icon size={15} style={{ color: color || "var(--color-primary)" }} />}
      </div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color: color || "#fff" }}>{value}</div>
    </Panel>
  );
}
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/15 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>
      {children}
    </button>
  );
}

// ── New nomination ───────────────────────────────────────────────────────────

function NewNominationModal({ open, onClose, ranks, colors, onCreate }) {
  const blank = () => ({ key: boardId("nom"), name: "", discordId: "", currentRank: "", proposedRank: "" });
  const [noms, setNoms] = useState([blank()]);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const setNom = (key, p) => setNoms((n) => n.map((x) => (x.key === key ? { ...x, ...p } : x)));

  function submit() {
    const clean = noms.filter((n) => n.name.trim());
    if (!clean.length) return setErr("Add at least one nominee with a name.");
    const bad = clean.find((n) => !n.proposedRank);
    if (bad) return setErr(`Pick a proposed rank for “${bad.name}”.`);
    onCreate(clean, reason);
  }

  return (
    <Modal open={open} onClose={onClose} title="New Promotion Vote" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Plus} onClick={submit}>Open Vote</Button></>}>
      <div className="grid grid-cols-1 gap-4">
        <p className="-mt-1 text-sm text-slate-400">Add one or multiple nominees. Each opens its own {DEFAULT_VOTE_HOURS}-hour vote.</p>
        {noms.map((n, i) => (
          <div key={n.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-primary)]">Nominee {i + 1}</span>
              {noms.length > 1 && <IconButton icon={X} label="Remove" onClick={() => setNoms((x) => x.filter((y) => y.key !== n.key))} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" hint="Format: callsign | rank | name">
                <Input value={n.name} onChange={(e) => setNom(n.key, { name: e.target.value })} placeholder="103 | Trial Mod | Name" />
              </Field>
              <Field label="Discord ID">
                <Input value={n.discordId} onChange={(e) => setNom(n.key, { discordId: e.target.value })} placeholder="e.g. 12345678901234567" className="font-mono" />
              </Field>
              <Field label="Current rank">
                <Select value={n.currentRank} onChange={(e) => setNom(n.key, { currentRank: e.target.value })}>
                  <option value="">Select rank…</option>
                  {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Proposed rank">
                <Select value={n.proposedRank} onChange={(e) => setNom(n.key, { proposedRank: e.target.value })}>
                  <option value="">Select rank…</option>
                  {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        ))}
        <Button variant="secondary" icon={Plus} onClick={() => setNoms((n) => [...n, blank()])}>Add another nominee</Button>
        <Field label="Reason" hint="Why is this person being nominated?">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}

// ── Rank colors ──────────────────────────────────────────────────────────────

function RankColorsModal({ open, onClose, ranks, colors, onSave }) {
  const [draft, setDraft] = useState(colors || {});
  return (
    <Modal open={open} onClose={onClose} title="Rank colors" size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(draft)}>Save</Button></>}>
      <div className="grid grid-cols-1 gap-2">
        <p className="-mt-1 text-sm text-slate-400">Color the rank pills on nominations. Leave blank for the default.</p>
        {ranks.length === 0 && <p className="text-sm text-slate-500">No ranks defined on the roster yet.</p>}
        {ranks.map((r) => (
          <div key={r} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
            <RankPill name={r} colors={draft} kind="proposed" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{r}</span>
            <input type="color" value={draft[r] || "#3b82f6"} onChange={(e) => setDraft((d) => ({ ...d, [r]: e.target.value }))} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
            {draft[r] && <IconButton icon={X} label="Clear" onClick={() => setDraft((d) => { const n = { ...d }; delete n[r]; return n; })} />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Result visibility (gating) ───────────────────────────────────────────────

function VisibilityModal({ open, onClose, groups, ranks, rules, onSave }) {
  const [draft, setDraft] = useState(rules || []);
  const ordered = [...groups].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const set = (i, p) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <Modal open={open} onClose={onClose} title="Live result visibility" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(draft.filter((r) => r.groupId))}>Save</Button></>}>
      <div className="grid grid-cols-1 gap-3">
        <p className="-mt-1 text-sm text-slate-400">
          Live tallies and ballots stay hidden from everyone until a vote is <span className="font-semibold text-slate-200">Published</span> — so members vote blind and can't bandwagon. Site managers always see live. Add rules to let specific groups see live results, capped by the rank being voted on.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {draft.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Group (and above)">
                <Select value={r.groupId} onChange={(e) => set(i, { groupId: e.target.value })}>
                  <option value="">Select group…</option>
                  {ordered.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </Select>
              </Field>
              <Field label="Can see votes up to rank">
                <Select value={r.maxRank || "__all"} onChange={(e) => set(i, { maxRank: e.target.value })}>
                  <option value="__all">All ranks</option>
                  {ranks.map((rk) => <option key={rk} value={rk}>{rk} and below</option>)}
                </Select>
              </Field>
              <div className="flex items-end pb-1">
                <IconButton icon={X} label="Remove rule" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="hover:border-red-500/40 hover:text-red-300" />
              </div>
            </div>
          ))}
          {draft.length === 0 && <p className="text-sm text-slate-500">No rules — only site managers see live results.</p>}
        </div>
        <Button variant="secondary" icon={Plus} onClick={() => setDraft((d) => [...d, { groupId: "", maxRank: "__all" }])}>Add rule</Button>
      </div>
    </Modal>
  );
}

// ── Vote detail ──────────────────────────────────────────────────────────────

function ApprovalRing({ pct, passing }) {
  const r = 42, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  const color = passing ? "#1eb854" : "#ef4444";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-black text-white">{pct}%</div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Approval</div>
      </div>
    </div>
  );
}

function AnalyticsTab({ vote }) {
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api.getDutyHours().then((feed) => {
      if (!alive) return;
      const h = (feed?.members || []).find((m) => String(m.discordId) === String(vote.discordId));
      setHours(h || null); setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [vote.discordId]);
  const hm = (n) => { const h = Math.floor(n); const m = Math.round((n - h) * 60); return `${h}h ${m}m`; };
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">Activity (Duty Hub)</div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading activity…</p>
      ) : !hours ? (
        <p className="text-sm text-slate-500">No Duty Hub activity found for this Discord ID.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <StatCard label="Hours this week" value={hm(Number(hours.weekHours) || 0)} icon={Clock} color="#3b82f6" />
          <StatCard label="Hours this month" value={hm(Number(hours.monthHours) || 0)} icon={Activity} color="#a855f7" />
        </div>
      )}
      <p className="text-xs text-slate-500">On-duty hours come from the Duty Hub. Richer Discord metrics (messages, vest sessions, report claims) would come from a bot/backend feed.</p>
    </div>
  );
}

function VoteModal({ vote, colors, user, canManage, canSee, pubStatus, now, onClose, onVote, onPublish, onCancel }) {
  const [tab, setTab] = useState("promotion");
  const [choice, setChoice] = useState(null);
  const [reason, setReason] = useState("");
  const t = tally(vote);
  const status = pubStatus; // status the viewer is allowed to see
  const open = voteStatus(vote, now) === "pending"; // real open state (voting allowed)
  const mine = myBallot(vote, user);
  const bar = (n) => (t.total ? Math.round((n / t.total) * 100) : 0);

  function submit() {
    if (!choice) return;
    onVote(vote.id, choice, reason.trim());
    setChoice(null); setReason("");
  }

  const TABS = [
    { id: "promotion", label: "Promotion", icon: ShieldCheck },
    { id: "tracker", label: "Vote Tracker", icon: Users2 },
    { id: "analytics", label: "Analytics", icon: Activity },
  ];

  return (
    <Modal open onClose={onClose} size="xl"
      title={<span className="flex items-center gap-2"><span className="text-slate-500">Promotion Board ›</span> {vote.name}</span>}
      footer={
        canManage && open ? (
          <>
            <Button variant="secondary" icon={FileText} onClick={() => onPublish(vote.id)}>Publish Results</Button>
            <Button variant="danger" icon={X} onClick={() => onCancel(vote.id)}>Cancel Vote</Button>
          </>
        ) : <Button variant="secondary" onClick={onClose}>Close</Button>
      }>
      <div className="grid grid-cols-1 gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={vote.name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-white">{vote.name}</span>
              <StatusPill s={status} />
            </div>
            <div className="mt-1"><PromoPath vote={vote} colors={colors} /></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10">
          {TABS.map((tt) => (
            <button key={tt.id} onClick={() => setTab(tt.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === tt.id ? "border-[var(--color-primary)] text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
              <tt.icon size={14} />{tt.label}
            </button>
          ))}
        </div>

        {tab === "promotion" && (
          <div className="grid grid-cols-1 gap-4">
            {canSee ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Approve" value={t.approve} icon={CircleCheck} color="#1eb854" />
                <StatCard label="Deny" value={t.deny} icon={CircleX} color="#ef4444" />
                <StatCard label="Abstain" value={t.abstain} icon={MinusCircle} color="#f59e0b" />
                <StatCard label="Approval" value={`${t.approval}%`} icon={TrendingUp} color="#3b82f6" />
                <StatCard label="Trend" value={t.passing ? "Passing" : "Failing"} icon={TrendingUp} color={t.passing ? "#1eb854" : "#ef4444"} />
              </div>
            ) : (
              <Panel className="flex items-center gap-3 p-4 text-sm text-slate-400">
                <Lock size={18} className="shrink-0 text-slate-500" />
                Results stay hidden until this vote is published. Cast your vote below — you won't see the tally until then.
              </Panel>
            )}
            <Panel className="p-3 text-xs text-slate-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>By {vote.createdBy?.name || "—"}</span>
                <span>Opens {fmtDT(vote.opensAt)}</span>
                <span>Closes {fmtDT(vote.closesAt)}</span>
                {open && <span className="text-slate-300">Closes in {countdown(vote.closesAt, now)}</span>}
              </div>
              {vote.reason && <div className="mt-1.5 text-sm text-slate-200">{vote.reason}</div>}
            </Panel>

            <div className={`grid items-start gap-4 ${canSee ? "lg:grid-cols-2" : ""}`}>
              {/* Cast vote */}
              <Panel className="grid gap-3 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">Cast your vote</div>
                {!open ? (
                  <p className="text-sm text-slate-500">Voting is closed.</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-400">
                      {mine ? <>You voted <span className="font-semibold" style={{ color: CHOICES.find((c) => c.id === mine.choice)?.color }}>{CHOICES.find((c) => c.id === mine.choice)?.label}</span>. Re-submit to change it.</> : "You have not voted yet."}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {CHOICES.map((c) => {
                        const Icon = c.id === "approve" ? ThumbsUp : c.id === "deny" ? ThumbsDown : MinusCircle;
                        const on = choice === c.id;
                        return (
                          <button key={c.id} onClick={() => setChoice(c.id)}
                            className="flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold transition"
                            style={on ? { borderColor: c.color, background: `color-mix(in srgb, ${c.color} 15%, transparent)`, color: "#fff" } : { borderColor: "rgba(255,255,255,0.1)", color: "#cbd5e1" }}>
                            <Icon size={16} style={{ color: c.color }} />{c.label}
                          </button>
                        );
                      })}
                    </div>
                    <Field label="Reason">
                      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note on your vote…" />
                    </Field>
                    <Button disabled={!choice} onClick={submit}>Submit Vote</Button>
                  </>
                )}
              </Panel>

              {/* Activity */}
              {canSee && (
              <Panel className="grid gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">Vote activity</div>
                  <Badge>{t.total} votes</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <ApprovalRing pct={t.approval} passing={t.passing} />
                  <div className="min-w-0 flex-1 space-y-2">
                    {[["Approve", t.approve, "#1eb854"], ["Deny", t.deny, "#ef4444"], ["Abstain", t.abstain, "#f59e0b"]].map(([l, n, col]) => (
                      <div key={l}>
                        <div className="mb-0.5 flex justify-between text-xs"><span className="text-slate-300">{l}</span><span className="text-slate-400">{n} ({bar(n)}%)</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${bar(n)}%`, background: col }} /></div>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-white/10 pt-2 text-xs"><span className="text-slate-500">Total votes</span><span className="font-bold text-white">{t.total}</span></div>
                  </div>
                </div>
              </Panel>
              )}
            </div>
          </div>
        )}

        {tab === "tracker" && (
          !canSee ? (
            <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Ballots stay anonymous until this vote is published.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {CHOICES.map((c) => {
                const list = (vote.ballots || []).filter((b) => b.choice === c.id);
                if (!list.length) return null;
                return (
                  <div key={c.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: c.color }}>{c.label}d</span>
                      <Badge color={c.color}>{list.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {list.map((b, i) => (
                        <Panel key={i} className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={b.voter?.name} className="h-8 w-8" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">{b.voter?.name || "Unknown"}</div>
                              {b.voter?.discordId && <div className="truncate font-mono text-[11px] text-slate-500">{b.voter.discordId}</div>}
                            </div>
                            <span className="text-[11px] text-slate-500">{fmtDT(b.at)}</span>
                          </div>
                          {b.reason && <div className="mt-1.5 text-sm text-slate-300">{b.reason}</div>}
                        </Panel>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(vote.ballots || []).length === 0 && <p className="text-sm text-slate-500">No votes cast yet.</p>}
            </div>
          )
        )}

        {tab === "analytics" && <AnalyticsTab vote={vote} />}
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PromotionBoard({ page, user }) {
  const { config, mutate } = useConfig();
  const cfg = page?.config || {};
  const votes = cfg.votes || [];
  const colors = cfg.rankColors || {};
  const rules = cfg.resultAccess || [];
  const ranks = useMemo(() => allRankNames(config), [config]);
  const canManage = canManageSite(user, config);
  const now = useNow();

  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const show = (m) => { setToast({ text: m }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); };

  const [creating, setCreating] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const setCfg = (patch) => mutate((c) => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p)) }));
  const setVotes = (next) => setCfg({ votes: typeof next === "function" ? next(votes) : next });

  function createVotes(noms, reason) {
    const created = noms.map((n) => newVote({ ...n, reason, createdBy: { name: who(user), discordId: user?.id || "" }, now: Date.now() }));
    setVotes([...created, ...votes]);
    setCreating(false);
    show(created.length > 1 ? `${created.length} votes opened` : "Vote opened");
    // One Discord ping for the whole batch (fire-and-forget).
    const wh = promoWebhook(config);
    if (wh.enabled && wh.url) {
      const boardUrl = typeof window !== "undefined" ? `${window.location.origin}${getPagePath(page.id, config)}` : "";
      sendPromotionWebhook(wh, {
        members: created.map((v) => ({ name: v.name, currentRank: v.currentRank, proposedRank: v.proposedRank, discordId: v.discordId })),
        boardUrl,
        durationLabel: `${DEFAULT_VOTE_HOURS} hours`,
        now: Date.now(),
      });
    }
  }
  function castVote(voteId, choice, reason) {
    const k = String(user?.id || "");
    setVotes(votes.map((v) => {
      if (v.id !== voteId) return v;
      const others = (v.ballots || []).filter((b) => String(b.voter?.discordId || "") !== k);
      return { ...v, ballots: [...others, { voter: { name: who(user), discordId: user?.id || "" }, choice, reason, at: new Date().toISOString() }] };
    }));
    show("Vote submitted");
  }
  const publish = (id) => { setVotes(votes.map((v) => (v.id === id ? { ...v, published: true, publishedAt: new Date().toISOString() } : v))); show("Results published"); };
  const cancel = (id) => { setVotes(votes.map((v) => (v.id === id ? { ...v, status: "cancelled" } : v))); show("Vote cancelled"); };

  // Everything the *viewer* sees respects gating: an unpublished vote's outcome
  // reads "pending" to anyone without result access.
  const pubStatus = (v) => publicStatus(user, config, v, rules, now);
  const stats = useMemo(() => {
    const s = { pending: 0, approved: 0, denied: 0, published: 0, cancelled: 0, total: votes.length };
    for (const v of votes) s[pubStatus(v)] += 1;
    return s;
  }, [votes, user, config, rules, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const term = q.trim().toLowerCase();
  const shown = votes
    .filter((v) => filter === "all" || pubStatus(v) === filter)
    .filter((v) => !term || `${v.name} ${v.discordId} ${v.currentRank} ${v.proposedRank}`.toLowerCase().includes(term))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const needsMyVote = votes.filter((v) => voteStatus(v, now) === "pending" && !myBallot(v, user));

  const openVote = openId ? votes.find((v) => v.id === openId) : null;

  const FILTERS = [["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["denied", "Closed - Denied"], ["published", "Published"], ["cancelled", "Cancelled"]];

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker || "Staff Operations"}
        title={cfg.heroTitle || page?.label || "Promotion Board"}
        subtitle={cfg.heroSubtitle || "Active votes stay anonymous until polls close for regular viewers."}
        actions={canManage && (
          <>
            <Button variant="secondary" icon={Eye} onClick={() => setVisOpen(true)}>Visibility</Button>
            <Button variant="secondary" icon={Palette} onClick={() => setColorsOpen(true)}>Rank Colors</Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>New Nomination</Button>
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Pending" value={stats.pending} icon={Clock} color="#f59e0b" />
        <StatCard label="Approved" value={stats.approved} icon={CircleCheck} color="#1eb854" />
        <StatCard label="Denied" value={stats.denied} icon={CircleX} color="#ef4444" />
        <StatCard label="Published" value={stats.published} icon={FileText} color="#3b82f6" />
        <StatCard label="Total" value={stats.total} icon={TrendingUp} />
      </div>

      <Panel className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Discord ID, or rank…" className="pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}
        </div>
      </Panel>

      {needsMyVote.length > 0 && filter === "all" && !term && (
        <Panel className="mb-4 overflow-hidden p-0">
          <div className="border-b border-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">Needs your vote <Badge>{needsMyVote.length}</Badge></div>
          <VoteTable votes={needsMyVote} colors={colors} user={user} config={config} rules={rules} now={now} onOpen={setOpenId} />
        </Panel>
      )}

      {votes.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No nominations yet" subtitle={canManage ? "Open a promotion vote with New Nomination." : "Promotion votes will show here."}
          action={canManage && <Button icon={Plus} onClick={() => setCreating(true)}>New Nomination</Button>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches" subtitle="Try another search or filter." />
      ) : (
        <Panel className="overflow-hidden p-0">
          <VoteTable votes={shown} colors={colors} user={user} config={config} rules={rules} now={now} onOpen={setOpenId} />
        </Panel>
      )}

      {creating && <NewNominationModal open onClose={() => setCreating(false)} ranks={ranks} colors={colors} onCreate={createVotes} />}
      {colorsOpen && <RankColorsModal open onClose={() => setColorsOpen(false)} ranks={ranks} colors={colors} onSave={(rankColors) => { setCfg({ rankColors }); setColorsOpen(false); show("Rank colors saved"); }} />}
      {visOpen && <VisibilityModal open onClose={() => setVisOpen(false)} groups={config.groups || []} ranks={ranks} rules={rules} onSave={(resultAccess) => { setCfg({ resultAccess }); setVisOpen(false); show("Visibility saved"); }} />}
      {openVote && (
        <VoteModal vote={openVote} colors={colors} user={user} canManage={canManage}
          canSee={canSeeResults(user, config, openVote, rules)} pubStatus={pubStatus(openVote)} now={now}
          onClose={() => setOpenId(null)} onVote={castVote} onPublish={publish} onCancel={cancel} />
      )}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function VoteTable({ votes, colors, user, config, rules, now, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5 font-semibold">Nominee</th>
            <th className="px-4 py-2.5 font-semibold">Promotion Path</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Closes In</th>
            <th className="px-4 py-2.5 font-semibold">Votes</th>
            <th className="px-4 py-2.5 font-semibold">Your Vote</th>
            <th className="px-4 py-2.5 font-semibold">Created By</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((v) => {
            const t = tally(v);
            const canSee = canSeeResults(user, config, v, rules);
            const status = publicStatus(user, config, v, rules, now);
            const mine = myBallot(v, user);
            return (
              <tr key={v.id} onClick={() => onOpen(v.id)} className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={v.name} className="h-8 w-8" />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{v.name}</div>
                      {v.discordId && <div className="truncate font-mono text-[11px] text-slate-500">ID: {v.discordId}</div>}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3"><PromoPath vote={v} colors={colors} /></td>
                <td className="px-4 py-3"><StatusPill s={status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{status === "pending" ? countdown(v.closesAt, now) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {canSee ? (
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">{t.approve}</span>
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">{t.deny}</span>
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{t.abstain}</span>
                      <span className="text-slate-500">{t.approval}%</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock size={12} /> Hidden</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {mine ? <Badge color={CHOICES.find((c) => c.id === mine.choice)?.color}>{CHOICES.find((c) => c.id === mine.choice)?.label}</Badge> : <Badge>N/A</Badge>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                  <div className="truncate">{v.createdBy?.name || "—"}</div>
                  <div>{fmtDT(v.createdAt)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
