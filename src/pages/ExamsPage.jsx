import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, GraduationCap, ClipboardList, Search, Check, X,
  CircleCheck, CircleX, Clock, FileText, Eye, EyeOff, Copy, ExternalLink, Link2, Users,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { safeLinkUrl, safeMediaUrl } from "../lib/urls.js";
import {
  Panel, PageHeader, SectionHeader, Button, IconButton, Field, Input, Select,
  Textarea, Badge, EmptyState, Modal, ConfirmDialog, useModalData, Toast, CommaListInput,
} from "../components/common/index.jsx";
import {
  QUESTION_TYPES, blankExam, blankQuestion, typeHasOptions,
  gradeSubmission, applyReview, canManageExams, canTakeExam, canReviewExam, canReviewAny,
} from "../lib/exams.js";

const who = (u) => u?.displayName || u?.username || "Unknown";
function formatAnswer(ans) {
  if (ans == null || ans === "") return "";
  if (Array.isArray(ans)) return ans.join(", ");
  if (typeof ans === "object") {
    return Object.entries(ans)
      .map(([row, v]) => `${row}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" · ");
  }
  return String(ans);
}
const uid = (p) => `${p}-${(crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).slice(0, 8)}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

function StatusBadge({ s }) {
  if (s === "passed") return <Badge color="#1eb854">Passed</Badge>;
  if (s === "failed") return <Badge color="#ef4444">Failed</Badge>;
  return <Badge color="#f59e0b">Needs review</Badge>;
}

// Render a description that supports \n newlines and **bold** (Staff Hub style).
function RichText({ text, className = "" }) {
  if (!text) return null;
  return (
    <div className={className}>
      {String(text).split("\n").map((line, i) => (
        <p key={i} className={line.trim() ? "" : "h-2"}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            /^\*\*[^*]+\*\*$/.test(part) ? <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part
          )}
        </p>
      ))}
    </div>
  );
}

function ResourceButtons({ links }) {
  const items = (links || []).filter((l) => l.label && l.url);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((l, i) => (
        <a key={i} href={safeLinkUrl(l.url)} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-[color:var(--color-primary)]/20">
          {l.label} <ExternalLink size={12} />
        </a>
      ))}
    </div>
  );
}

// ── Take an exam ─────────────────────────────────────────────────────────────

// Google-Forms-style star rating: real stars that fill on hover and click.
function StarRating({ max, value, onChange }) {
  const [hover, setHover] = useState(0);
  const stars = [];
  for (let n = 1; n <= max; n++) stars.push(n);
  const active = hover || Number(value) || 0;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(String(n))}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={`text-3xl leading-none transition-transform hover:scale-110 ${n <= active ? "text-amber-400" : "text-slate-600"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function AnswerInput({ q, value, onChange }) {
  if (q.type === "paragraph")
    return <Textarea rows={4} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "short")
    return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="Your answer" />;
  if (q.type === "truefalse")
    return (
      <div className="flex gap-2">
        {["True", "False"].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              value === o ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/15 text-white" : "border-white/10 text-slate-300 hover:border-white/25"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  if (q.type === "dropdown")
    return (
      <Select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {(q.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
      </Select>
    );
  if (q.type === "date")
    return <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "time")
    return <Input type="time" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "scale") {
    const min = Number(q.scaleMin ?? 1), max = Number(q.scaleMax ?? 5);
    const nums = []; for (let n = min; n <= max; n++) nums.push(n);
    return (
      <div className="flex items-end gap-3">
        {q.minLabel && <span className="shrink-0 pb-0.5 text-right text-xs text-slate-500">{q.minLabel}</span>}
        <div className="flex flex-1 items-start justify-between gap-1">
          {nums.map((n) => {
            const on = String(value) === String(n);
            return (
              <button key={n} type="button" onClick={() => onChange(String(n))} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs font-semibold tabular-nums ${on ? "text-white" : "text-slate-500"}`}>{n}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${on ? "border-[var(--color-primary)]" : "border-white/30 hover:border-white/50"}`}>
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />}
                </span>
              </button>
            );
          })}
        </div>
        {q.maxLabel && <span className="shrink-0 pb-0.5 text-xs text-slate-500">{q.maxLabel}</span>}
      </div>
    );
  }
  if (q.type === "rating") return <StarRating max={Number(q.ratingMax ?? 5)} value={value} onChange={onChange} />;
  if (q.type === "mcgrid" || q.type === "cbgrid") {
    const cb = q.type === "cbgrid";
    const val = value || {};
    const setCell = (row, col) => {
      if (!cb) return onChange({ ...val, [row]: col });
      const cur = Array.isArray(val[row]) ? val[row] : [];
      onChange({ ...val, [row]: cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col] });
    };
    const on = (row, col) => (cb ? (val[row] || []).includes(col) : val[row] === col);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th />
              {(q.columns || []).map((c, i) => <th key={i} className="px-2 pb-1 text-xs font-semibold text-slate-400">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {(q.rows || []).map((r, ri) => (
              <tr key={ri}>
                <td className="py-1 pr-2 text-slate-300">{r}</td>
                {(q.columns || []).map((c, ci) => (
                  <td key={ci} className="px-2 text-center">
                    <button type="button" onClick={() => setCell(r, c)}
                      className={`h-5 w-5 border ${cb ? "rounded" : "rounded-full"} ${on(r, c) ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-white/25"}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // multiple / checkboxes
  const multi = q.type === "checkboxes";
  const arr = Array.isArray(value) ? value : [];
  const toggle = (o) => {
    if (!multi) return onChange(o);
    onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
  };
  const on = (o) => (multi ? arr.includes(o) : value === o);
  return (
    <div className="grid gap-1.5">
      {(q.options || []).map((o, i) => (
        <button
          key={i}
          type="button"
          onClick={() => toggle(o)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
            on(o) ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/12 text-white" : "border-white/10 text-slate-300 hover:border-white/25"
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${multi ? "rounded" : "rounded-full"} ${on(o) ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-white/30"}`}>
            {on(o) && <Check size={11} />}
          </span>
          {o}
        </button>
      ))}
    </div>
  );
}

const progressKey = (examId) => `exam-progress:${examId}`;

function TakeExamModal({ open, onClose, exam, user, onSubmit }) {
  // Restore any auto-saved progress for this exam.
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(progressKey(exam.id)) || "null"); } catch { return null; }
  })();
  const [answers, setAnswers] = useState(saved?.answers || {});
  const [subject, setSubject] = useState(saved?.subject || { name: who(user), discordId: user?.id || "" });
  const [err, setErr] = useState("");
  const set = (qid, v) => setAnswers((a) => ({ ...a, [qid]: v }));

  // Auto-save progress as they go (Staff Hub style).
  useEffect(() => {
    if (exam.anonymous) return; // don't persist anonymous responses
    try { localStorage.setItem(progressKey(exam.id), JSON.stringify({ answers, subject })); } catch { /* quota */ }
  }, [answers, subject, exam.id, exam.anonymous]);
  // Scramble the question order once per attempt when enabled.
  const questions = useMemo(() => {
    const qs = exam.questions || [];
    if (!exam.scramble) return qs;
    const a = [...qs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  function submit() {
    if (!exam.anonymous && !subject.name.trim()) {
      setErr("Please enter your name before submitting.");
      return;
    }
    const missing = (exam.questions || []).find((q) => {
      if (!q.required) return false;
      const v = answers[q.id];
      return v == null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
    });
    if (missing) {
      setErr("Please answer every required question before submitting.");
      return;
    }
    try { localStorage.removeItem(progressKey(exam.id)); } catch { /* ignore */ }
    const subj = exam.anonymous
      ? { name: "Anonymous", discordId: "" }
      : { name: subject.name.trim(), discordId: subject.discordId.trim() };
    onSubmit(exam, answers, subj);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exam.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Submit exam</Button>
        </>
      }
    >
      <div className="grid gap-4">
        {safeMediaUrl(exam.banner) && (
          <img src={safeMediaUrl(exam.banner)} alt="" onError={(e) => (e.currentTarget.style.display = "none")}
            className="h-28 w-full rounded-xl object-cover" />
        )}
        {exam.description && <RichText text={exam.description} className="text-sm leading-relaxed text-slate-400" />}
        <ResourceButtons links={exam.resourceLinks} />
        {!exam.anonymous && (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
            <Field label="Your name" hint="Recorded on the submission.">
              <Input value={subject.name} onChange={(e) => setSubject((s) => ({ ...s, name: e.target.value }))} />
            </Field>
            <Field label="Discord ID">
              <Input value={subject.discordId} onChange={(e) => setSubject((s) => ({ ...s, discordId: e.target.value }))} className="font-mono" placeholder="000000000000000000" />
            </Field>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {exam.anonymous ? "Anonymous, your name is not recorded. " : `Pass mark ${exam.passThreshold}%. `}
          Required questions are marked with *. {!exam.anonymous && "Progress auto-saves as you go."}
        </p>
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
            <div className="mb-2 text-sm font-semibold text-white">
              {i + 1}. {q.prompt || <span className="italic text-slate-500">Untitled question</span>}
              {q.required && <span className="ml-1 text-red-400">*</span>}
              <span className="ml-2 text-xs font-normal text-slate-500">({q.points} pt{q.points === 1 ? "" : "s"})</span>
            </div>
            <AnswerInput q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          </div>
        ))}
        {err && <p className="text-sm text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}

function ResultModal({ open, onClose, result }) {
  if (!result) return null;
  const survey = result.maxScore === 0;
  const review = !survey && result.status === "needs-review";
  return (
    <Modal open={open} onClose={onClose} title="Submitted" size="sm"
      footer={<Button onClick={onClose}>Done</Button>}>
      <div className="grid gap-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: survey ? "#1eb85422" : review ? "#f59e0b22" : result.status === "passed" ? "#1eb85422" : "#ef444422" }}>
          {survey ? <CircleCheck size={26} className="text-green-400" />
            : review ? <Clock size={26} className="text-amber-400" />
            : result.status === "passed" ? <CircleCheck size={26} className="text-green-400" />
            : <CircleX size={26} className="text-red-400" />}
        </div>
        {survey ? (
          <>
            <div className="text-lg font-bold text-white">Response submitted</div>
            <p className="text-sm text-slate-400">Thanks, your response has been recorded.</p>
          </>
        ) : review ? (
          <>
            <div className="text-lg font-bold text-white">Submitted for review</div>
            <p className="text-sm text-slate-400">
              Your objective answers scored {result.score}/{result.maxScore}. Written answers still need a reviewer, so your final result is pending.
            </p>
          </>
        ) : (
          <>
            <div className="text-lg font-bold text-white">{result.percent}% — {result.status === "passed" ? "Passed" : "Failed"}</div>
            <p className="text-sm text-slate-400">You scored {result.score} of {result.maxScore} points.</p>
          </>
        )}
        {result.completionMessage && (
          <RichText text={result.completionMessage} className="mt-1 text-sm leading-relaxed text-slate-400" />
        )}
      </div>
    </Modal>
  );
}

// ── Submissions + review ─────────────────────────────────────────────────────

function SubmissionDetail({ submission, canReview, onReview }) {
  const [awards, setAwards] = useState(() => {
    const o = {};
    (submission.graded || []).forEach((g) => { if (g.needsReview) o[g.questionId] = g.awarded; });
    return o;
  });
  const qById = (id) => (submission.questions || []).find((q) => q.id === id) || {};
  const gById = (id) => (submission.graded || []).find((g) => g.questionId === id) || {};
  const pending = (submission.graded || []).some((g) => g.needsReview);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-white">{submission.subject?.name || "—"}</span>
        {submission.subject?.discordId && <span className="font-mono text-xs text-slate-500">{submission.subject.discordId}</span>}
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{submission.examTitle}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-slate-400">{submission.score}/{submission.maxScore} ({submission.percent}%)</span>
          <StatusBadge s={submission.status} />
        </span>
      </div>
      {(submission.questions || []).map((q, i) => {
        const g = gById(q.id);
        const ans = submission.answers?.[q.id];
        const ansText = formatAnswer(ans);
        return (
          <div key={q.id} className="rounded-lg border border-white/10 bg-[var(--color-surface-2)] p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-white">{i + 1}. {q.prompt}</div>
              <div className="shrink-0 text-xs text-slate-400">
                {g.needsReview ? `— / ${g.max}` : `${g.awarded} / ${g.max}`}
                {!g.needsReview && q.type !== "paragraph" && (
                  g.correct ? <Check size={13} className="ml-1 inline text-green-400" /> : <X size={13} className="ml-1 inline text-red-400" />
                )}
              </div>
            </div>
            <div className="text-sm text-slate-300">{ansText || <span className="italic text-slate-600">No answer</span>}</div>
            {g.needsReview && canReview && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Award points:</span>
                <Input type="number" min={0} max={g.max} value={awards[q.id] ?? 0}
                  onChange={(e) => setAwards((a) => ({ ...a, [q.id]: e.target.value }))} className="w-20" />
                <span className="text-xs text-slate-500">/ {g.max}</span>
              </div>
            )}
          </div>
        );
      })}
      {pending && canReview && (
        <div className="flex justify-end">
          <Button onClick={() => onReview(submission, awards)}>Save review &amp; grade</Button>
        </div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3.5 py-2">
      <Icon size={18} className="text-[var(--color-primary)]" />
      <div>
        <div className="text-lg font-black leading-none tabular-nums text-white">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-cad-muted">{label}</div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-[var(--color-primary)] text-white" : "text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SubmissionRow({ s, onOpen }) {
  return (
    <button onClick={onOpen} className="flex items-center gap-3 bg-[var(--color-surface-1)] px-4 py-2.5 text-left transition hover:bg-white/[0.03]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{s.subject?.name || "Anonymous"}</div>
        <div className="truncate text-xs text-slate-500">{s.examTitle}</div>
      </div>
      <div className="shrink-0 text-sm tabular-nums">
        <span className="font-bold text-white">{s.score}</span>
        <span className="text-slate-500"> / {s.maxScore}</span>
      </div>
      <StatusBadge s={s.status} />
    </button>
  );
}

function SubmissionsTab({ exams, submissions, user, config, onReview }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // "all" or an exam id
  const [detail, setDetail] = useState(null); // submission open in the review modal
  const examById = (id) => exams.find((e) => e.id === id);
  const canReviewSub = (s) => {
    const e = examById(s.examId);
    return e ? canReviewExam(user, config, e) : canManageExams(user, config);
  };
  const reviewableExams = exams.filter((e) => canReviewExam(user, config, e));

  const term = q.trim().toLowerCase();
  const matchTerm = (s) => !term || `${s.subject?.name || ""} ${s.subject?.discordId || ""}`.toLowerCase().includes(term);
  const all = submissions.filter(canReviewSub).filter(matchTerm);

  // Group by exam, newest first within each.
  const byExam = new Map(reviewableExams.map((e) => [e.id, []]));
  for (const s of all) if (byExam.has(s.examId)) byExam.get(s.examId).push(s);
  for (const arr of byExam.values()) arr.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  let shownExams = filter === "all" ? reviewableExams : reviewableExams.filter((e) => e.id === filter);
  if (term) shownExams = shownExams.filter((e) => (byExam.get(e.id) || []).length > 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-white">Recent submissions</div>
          <div className="text-xs text-slate-500">Latest exam submissions, grouped by exam.</div>
        </div>
        <div className="flex gap-2">
          <StatPill icon={ClipboardList} value={all.length} label="Submissions" />
          <StatPill icon={GraduationCap} value={reviewableExams.length} label="Exam types" />
        </div>
      </div>

      <Panel className="p-3">
        <div className="relative mb-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or Discord ID…" className="pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All exams</Chip>
          {reviewableExams.map((e) => (
            <Chip key={e.id} active={filter === e.id} onClick={() => setFilter(e.id)}>{e.title}</Chip>
          ))}
        </div>
      </Panel>

      {reviewableExams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing to review" subtitle="You don't review submissions for any exam yet." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {shownExams.map((e) => {
            const list = byExam.get(e.id) || [];
            const capped = filter === "all" ? list.slice(0, 5) : list;
            return (
              <Panel key={e.id} className="flex flex-col overflow-hidden p-0">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <GraduationCap size={16} className="shrink-0 text-[var(--color-primary)]" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{e.title}</span>
                  <Badge>{list.length}</Badge>
                </div>
                {list.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">No submissions.</div>
                ) : (
                  <div className="grid gap-px bg-white/5">
                    {capped.map((s) => <SubmissionRow key={s.id} s={s} onOpen={() => setDetail(s)} />)}
                  </div>
                )}
                {filter === "all" && list.length > 5 && (
                  <button onClick={() => setFilter(e.id)} className="border-t border-white/10 px-4 py-2.5 text-center text-xs font-semibold text-slate-400 transition hover:text-white">
                    View all submissions
                  </button>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title="Submission" size="lg"
          footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}>
          <SubmissionDetail
            submission={detail}
            canReview={canReviewSub(detail)}
            onReview={(s, a) => { onReview(s, a); setDetail(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Members (a person's exam history) ────────────────────────────────────────

function MembersTab({ exams, submissions, user, config, onReview }) {
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState(null);
  const [openSub, setOpenSub] = useState(null);
  const examById = (id) => exams.find((e) => e.id === id);
  const canReviewSub = (s) => { const e = examById(s.examId); return e ? canReviewExam(user, config, e) : canManageExams(user, config); };

  const reviewable = submissions.filter(canReviewSub).filter((s) => s.subject?.name && s.subject.name !== "Anonymous");
  const map = new Map();
  for (const s of reviewable) {
    const key = s.subject.discordId || s.subject.name.toLowerCase();
    if (!map.has(key)) map.set(key, { key, name: s.subject.name, discordId: s.subject.discordId, subs: [] });
    map.get(key).subs.push(s);
  }
  const people = [...map.values()].sort((a, b) => (b.subs[0]?.at || "").localeCompare(a.subs[0]?.at || ""));
  const term = q.trim().toLowerCase();
  const visible = people.filter((p) => !term || `${p.name} ${p.discordId || ""}`.toLowerCase().includes(term));

  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a member by name or Discord ID…" className="pl-9" />
        </div>
      </Panel>
      {visible.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" subtitle="People who submit exams show up here with their full history." />
      ) : (
        <div className="grid gap-2">
          {visible.map((p) => {
            const passed = p.subs.filter((s) => s.status === "passed").length;
            return (
              <Panel key={p.key} className="p-0">
                <button onClick={() => setOpenKey(openKey === p.key ? null : p.key)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-slate-300">
                    {(p.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                    <div className="truncate text-xs text-slate-500">{p.discordId || "no Discord ID"} · {p.subs.length} exam{p.subs.length === 1 ? "" : "s"} · {passed} passed</div>
                  </div>
                </button>
                {openKey === p.key && (
                  <div className="grid gap-2 border-t border-white/10 p-3">
                    {p.subs.map((s) => (
                      <div key={s.id} className="rounded-lg border border-white/10 bg-[var(--color-surface-2)]">
                        <button onClick={() => setOpenSub(openSub === s.id ? null : s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                          <span className="min-w-0 flex-1 truncate text-sm text-white">{s.examTitle}</span>
                          <span className="text-xs text-slate-500">{fmtDate(s.at)}</span>
                          <span className="text-xs text-slate-400">{s.percent}%</span>
                          <StatusBadge s={s.status} />
                        </button>
                        {openSub === s.id && (
                          <div className="border-t border-white/10 p-3">
                            <SubmissionDetail submission={s} canReview={canReviewSub(s)} onReview={onReview} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Manage / build exams ─────────────────────────────────────────────────────

// A "group and above" tier picker (Staff Hub "Administrator+" style). Groups are
// listed high → low; picking one means that group and everyone above it qualifies.
function TierSelect({ label, hint, groups, value, anyoneLabel, onChange }) {
  const ordered = [...groups].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  return (
    <Field label={label} hint={hint}>
      <Select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyoneLabel}</option>
        {ordered.map((g) => (
          <option key={g.id} value={g.id}>{g.label} and above</option>
        ))}
      </Select>
    </Field>
  );
}

function ResourceLinksEditor({ links, onChange }) {
  const list = links || [];
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">Resource links</div>
      <div className="grid gap-1.5">
        {list.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--color-surface-2)] px-3 py-1.5 text-sm">
            <span className="font-semibold text-white">{l.label}</span>
            <span className="truncate font-mono text-xs text-slate-500">{l.url}</span>
            <IconButton icon={Trash2} label="Remove link" onClick={() => onChange(list.filter((_, j) => j !== i))} className="ml-auto hover:border-red-500/40 hover:text-red-300" />
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={label} placeholder="Label (e.g. Module 1)" onChange={(e) => setLabel(e.target.value)} />
        <Input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} className="font-mono" />
        <Button variant="secondary" icon={Plus} disabled={!label.trim() || !url.trim()}
          onClick={() => { onChange([...list, { label: label.trim(), url: url.trim() }]); setLabel(""); setUrl(""); }}>
          Add
        </Button>
      </div>
    </div>
  );
}

function QuestionEditor({ q, index, total, onMove, onChange, onDelete }) {
  const patch = (p) => onChange({ ...q, ...p });
  const setOptions = (options) => {
    // keep correct answers valid against the new options
    let correct = q.correct;
    if (q.type === "checkboxes") correct = (q.correct || []).filter((c) => options.includes(c));
    else if (typeHasOptions(q.type) && !options.includes(q.correct)) correct = "";
    patch({ options, correct });
  };
  const changeType = (type) => onChange({ ...blankQuestion(type), id: q.id, prompt: q.prompt, required: q.required, points: q.points });

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Select value={index} onChange={(e) => onMove(index, Number(e.target.value))} className="w-16">
          {Array.from({ length: total }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </Select>
        <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">of {total}</span>
        <IconButton icon={Trash2} label="Delete question" onClick={onDelete} className="ml-auto hover:border-red-500/40 hover:text-red-300" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <Field label="Question">
          <Input value={q.prompt} onChange={(e) => patch({ prompt: e.target.value })} placeholder="e.g. What is the 10-code for “out of service”?" />
        </Field>
        <Field label="Type">
          <Select value={q.type} onChange={(e) => changeType(e.target.value)}>
            {QUESTION_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </Select>
        </Field>
      </div>

      {typeHasOptions(q.type) && (
        <div className="mt-2 grid gap-1.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Options {q.type === "checkboxes" ? "(tick every correct one)" : "(tick the correct one)"}
          </div>
          {(q.options || []).map((o, i) => {
            const isCorrect = q.type === "checkboxes" ? (q.correct || []).includes(o) : q.correct === o;
            const markCorrect = () =>
              q.type === "checkboxes"
                ? patch({ correct: isCorrect ? q.correct.filter((c) => c !== o) : [...(q.correct || []), o] })
                : patch({ correct: o });
            return (
              <div key={i} className="flex items-center gap-2">
                <button type="button" onClick={markCorrect} title="Mark correct"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center border ${q.type === "checkboxes" ? "rounded" : "rounded-full"} ${isCorrect ? "border-green-500 bg-green-500 text-white" : "border-white/25 text-transparent"}`}>
                  <Check size={12} />
                </button>
                <Input value={o} onChange={(e) => setOptions((q.options || []).map((x, j) => (j === i ? e.target.value : x)))} className="flex-1" />
                <IconButton icon={Trash2} label="Remove option" onClick={() => setOptions((q.options || []).filter((_, j) => j !== i))} className="hover:border-red-500/40 hover:text-red-300" />
              </div>
            );
          })}
          <button type="button" onClick={() => setOptions([...(q.options || []), `Option ${(q.options?.length || 0) + 1}`])} className="mt-1 w-fit text-xs font-semibold text-[var(--color-primary)] hover:underline">
            + Add option
          </button>
        </div>
      )}

      {q.type === "truefalse" && (
        <Field label="Correct answer" className="mt-2">
          <Select value={q.correct} onChange={(e) => patch({ correct: e.target.value })}>
            <option value="True">True</option>
            <option value="False">False</option>
          </Select>
        </Field>
      )}

      {q.type === "short" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
          <Field label="Accepted answers" hint="Comma-separated. Leave blank to grade this one by hand.">
            <CommaListInput value={q.correct || []} onChange={(correct) => patch({ correct })} placeholder="10-7, ten seven" />
          </Field>
          <Field label="Match">
            <Select value={q.matchMode || "exact"} onChange={(e) => patch({ matchMode: e.target.value })}>
              <option value="exact">Exact (any accepted)</option>
              <option value="keywords">Keywords (all present)</option>
            </Select>
          </Field>
        </div>
      )}

      {q.type === "scale" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <Field label="From"><Input type="number" value={q.scaleMin ?? 1} onChange={(e) => patch({ scaleMin: Number(e.target.value) })} /></Field>
          <Field label="To"><Input type="number" value={q.scaleMax ?? 5} onChange={(e) => patch({ scaleMax: Number(e.target.value) })} /></Field>
          <Field label="Low label"><Input value={q.minLabel || ""} onChange={(e) => patch({ minLabel: e.target.value })} placeholder="e.g. Poor" /></Field>
          <Field label="High label"><Input value={q.maxLabel || ""} onChange={(e) => patch({ maxLabel: e.target.value })} placeholder="e.g. Great" /></Field>
          <Field label="Correct value" hint="Blank = ungraded (survey)." className="sm:col-span-2"><Input value={q.correct || ""} onChange={(e) => patch({ correct: e.target.value })} placeholder="e.g. 5" /></Field>
        </div>
      )}

      {q.type === "rating" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Max stars"><Input type="number" min={2} max={10} value={q.ratingMax ?? 5} onChange={(e) => patch({ ratingMax: Number(e.target.value) })} /></Field>
          <Field label="Correct value" hint="Blank = ungraded."><Input value={q.correct || ""} onChange={(e) => patch({ correct: e.target.value })} placeholder="e.g. 5" /></Field>
        </div>
      )}

      {(q.type === "date" || q.type === "time") && (
        <Field label="Correct answer" hint="Blank = ungraded (just collects the value)." className="mt-2">
          <Input type={q.type} value={q.correct || ""} onChange={(e) => patch({ correct: e.target.value })} />
        </Field>
      )}

      {(q.type === "mcgrid" || q.type === "cbgrid") && (
        <div className="mt-2 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Rows"><CommaListInput value={q.rows || []} onChange={(rows) => patch({ rows, correct: {} })} placeholder="Row 1, Row 2" /></Field>
            <Field label="Columns"><CommaListInput value={q.columns || []} onChange={(columns) => patch({ columns, correct: {} })} placeholder="Column 1, Column 2" /></Field>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">Answer key {q.type === "cbgrid" ? "(tick every correct cell)" : "(tick the correct cell per row)"} · blank = ungraded</div>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead><tr><th /> {(q.columns || []).map((c, i) => <th key={i} className="px-2 pb-1 text-slate-400">{c}</th>)}</tr></thead>
                <tbody>
                  {(q.rows || []).map((r, ri) => (
                    <tr key={ri}>
                      <td className="py-1 pr-2 text-slate-300">{r}</td>
                      {(q.columns || []).map((c, ci) => {
                        const key = q.correct || {};
                        const isCb = q.type === "cbgrid";
                        const on = isCb ? (key[r] || []).includes(c) : key[r] === c;
                        const toggle = () => {
                          if (!isCb) return patch({ correct: { ...key, [r]: c } });
                          const cur = Array.isArray(key[r]) ? key[r] : [];
                          patch({ correct: { ...key, [r]: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] } });
                        };
                        return (
                          <td key={ci} className="px-2 text-center">
                            <button type="button" onClick={toggle} className={`h-4 w-4 border ${isCb ? "rounded" : "rounded-full"} ${on ? "border-green-500 bg-green-500" : "border-white/25"}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {q.type === "paragraph" && (
        <p className="mt-2 text-xs text-slate-500">Graded by a reviewer, no answer key.</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={q.required} onChange={(e) => patch({ required: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
          Required
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          Points
          <Input type="number" min={0} value={q.points} onChange={(e) => patch({ points: Number(e.target.value) || 0 })} className="w-16" />
        </label>
      </div>
    </div>
  );
}

function ExamEditor({ open, onClose, exam, groups, onSave }) {
  const [draft, setDraft] = useState(exam);
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const setQ = (id, q) => patch({ questions: draft.questions.map((x) => (x.id === id ? q : x)) });
  const moveQ = (from, to) => {
    if (from === to) return;
    const qs = [...draft.questions];
    const [m] = qs.splice(from, 1);
    qs.splice(to, 0, m);
    patch({ questions: qs });
  };
  const total = (draft.questions || []).reduce((s, q) => s + (Number(q.points) || 0), 0);

  return (
    <Modal open={open} onClose={onClose} title={`Edit “${exam.title}”`} size="xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!draft.title.trim()} onClick={() => onSave(draft)}>Save exam</Button></>}>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Exam title"><Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} autoFocus /></Field>
          <Field label="Pass mark %"><Input type="number" min={0} max={100} value={draft.passThreshold} onChange={(e) => patch({ passThreshold: Number(e.target.value) || 0 })} /></Field>
        </div>
        <Field label="Banner image" hint="Optional header image shown on the form.">
          <Input value={draft.banner || ""} onChange={(e) => patch({ banner: e.target.value })} placeholder="https://… (direct image link)" />
        </Field>
        <Field label="Description" hint="Shown before they start. Use \n for new lines and **bold** for bold.">
          <Textarea rows={3} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
        <ResourceLinksEditor links={draft.resourceLinks} onChange={(resourceLinks) => patch({ resourceLinks })} />
        <Field label="Completion message" hint="Shown after submitting. Blank uses the default score message.">
          <Textarea rows={2} value={draft.completionMessage || ""} onChange={(e) => patch({ completionMessage: e.target.value })} />
        </Field>

        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
          <TierSelect label="Who can take this exam" hint="That group and everyone above it." groups={groups} value={draft.submitTier} anyoneLabel="Any signed-in member" onChange={(submitTier) => patch({ submitTier })} />
          <TierSelect label="Who can review submissions" hint="That group and above (managers always can)." groups={groups} value={draft.reviewTier} anyoneLabel="Site managers only" onChange={(reviewTier) => patch({ reviewTier })} />
        </div>
        <Field label="Restrict to Discord role ID (optional)" hint="When set, this exam is gated by a specific Discord role.">
          <Input value={draft.roleId || ""} onChange={(e) => patch({ roleId: e.target.value })} placeholder="000000000000000000" className="font-mono" />
        </Field>
        {draft.roleId && (
          <label className="flex items-start gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={draft.roleBypass !== false} onChange={(e) => patch({ roleBypass: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
            <span>Bypass the rank requirement — anyone holding this role can take it even if they don't meet the rank above. <span className="text-slate-500">Off: they need the rank AND the role.</span></span>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={!!draft.scramble} onChange={(e) => patch({ scramble: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
          Scramble question order (each test taker sees a randomized order)
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={!!draft.anonymous} onChange={(e) => patch({ anonymous: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
          <span>Anonymous — don't collect name or Discord ID (for feedback/surveys). <span className="text-slate-500">Submissions won't be tied to a person.</span></span>
        </label>

        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Questions ({draft.questions.length}) · {total} pts total
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={draft.published} onChange={(e) => patch({ published: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
            Published (people can take it)
          </label>
        </div>

        <div className="grid gap-2">
          {draft.questions.map((q, i) => (
            <QuestionEditor key={q.id} q={q} index={i} total={draft.questions.length} onMove={moveQ}
              onChange={(nq) => setQ(q.id, nq)} onDelete={() => patch({ questions: draft.questions.filter((x) => x.id !== q.id) })} />
          ))}
        </div>
        <Button variant="secondary" icon={Plus} onClick={() => patch({ questions: [...draft.questions, blankQuestion("multiple")] })}>Add question</Button>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExamsPage({ page, user }) {
  const { config, mutate } = useConfig();
  const cfg = page?.config || {};
  const exams = cfg.exams || [];
  const submissions = cfg.submissions || [];
  const groups = config.groups || [];

  const isManager = canManageExams(user, config);
  const takeable = exams.filter((e) => canTakeExam(user, config, e));
  const reviewer = isManager || canReviewAny(user, config, exams);

  const [toast, setToast] = useState("");
  const toastTimer = useRef();
  const show = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2600); };

  const TABS = [{ id: "take", label: "Available exams", icon: GraduationCap }];
  if (reviewer) TABS.push({ id: "submissions", label: "Recent submissions", icon: ClipboardList });
  if (reviewer) TABS.push({ id: "members", label: "Members", icon: Users });
  if (isManager) TABS.push({ id: "manage", label: "Manage exams", icon: Pencil });
  const [tab, setTab] = useState("take");

  const [taking, setTaking] = useState(null);
  const takingM = useModalData(taking);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(null);
  const editingM = useModalData(editing);
  const [confirmDel, setConfirmDel] = useState(null);

  // Deep link: /exams?exam=<id> opens that exam's take view (if allowed).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("exam");
    if (!id) return;
    const e = exams.find((x) => x.id === id);
    if (e && canTakeExam(user, config, e)) setTaking(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCfg = (patch) =>
    mutate((c) => ({ ...c, pages: c.pages.map((p) => (p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p)) }));
  const setExams = (next) => setCfg({ exams: next });
  const setSubmissions = (next) => setCfg({ submissions: next });

  function submitExam(exam, answers, subject) {
    const grade = gradeSubmission(exam, answers);
    const submission = {
      id: uid("sub"),
      examId: exam.id,
      examTitle: exam.title,
      passThreshold: exam.passThreshold,
      subject: subject || { name: who(user), discordId: user?.id || "" },
      by: { name: who(user), discordId: user?.id || "" },
      at: new Date().toISOString(),
      questions: (exam.questions || []).map((q) => ({ id: q.id, prompt: q.prompt, type: q.type, options: q.options, points: q.points })),
      answers,
      ...grade,
    };
    setSubmissions([submission, ...submissions]);
    setTaking(null);
    setResult({ ...grade, completionMessage: exam.completionMessage });
  }

  function reviewSubmission(sub, awards) {
    const overrides = {};
    for (const k of Object.keys(awards)) overrides[k] = Number(awards[k]) || 0;
    const updated = applyReview({ passThreshold: sub.passThreshold }, sub, overrides);
    updated.reviewedBy = who(user);
    updated.reviewedAt = new Date().toISOString();
    setSubmissions(submissions.map((s) => (s.id === sub.id ? updated : s)));
    show(`Review saved, ${updated.percent}% (${updated.status})`);
  }

  function saveExam(draft) {
    setExams(exams.some((e) => e.id === draft.id) ? exams.map((e) => (e.id === draft.id ? draft : e)) : [...exams, draft]);
    setEditing(null);
    show("Exam saved");
  }

  return (
    <div>
      <PageHeader
        kicker="Assessments"
        title={cfg.heroTitle || page?.label || "Exams"}
        subtitle={cfg.heroSubtitle || "Take department exams; objective answers grade instantly, written answers are reviewed by staff."}
        actions={isManager && tab === "manage" && (
          <Button icon={Plus} onClick={() => setEditing(blankExam())}>New exam</Button>
        )}
      />

      {TABS.length > 1 && (
        <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.id ? "bg-[color:var(--color-primary)]/20 text-white" : "text-slate-400 hover:text-white"}`}>
              <t.icon size={15} />{t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "take" && (
        takeable.length === 0 ? (
          <EmptyState icon={FileText} title="No exams available" subtitle={isManager ? "Create one under Manage exams, then publish it." : "Nothing has been assigned to you yet."} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {takeable.map((e) => (
              <Panel
                key={e.id}
                className="group flex flex-col overflow-hidden p-0 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[color:var(--color-primary)]/60 hover:shadow-[0_12px_34px_-12px_var(--color-primary)]"
              >
                <div className="h-36 w-full overflow-hidden bg-black/30">
                  {safeMediaUrl(e.banner) && (
                    <img src={safeMediaUrl(e.banner)} alt="" onError={(ev) => (ev.currentTarget.style.display = "none")}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <GraduationCap size={16} className="shrink-0 text-[var(--color-primary)]" />
                    <div className="font-semibold text-white">{e.title}</div>
                    {e.anonymous && <Badge>Anonymous</Badge>}
                  </div>
                  {e.description && (
                    <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-slate-400">{e.description.replace(/\*\*/g, "")}</p>
                  )}
                  <div className="mt-auto">
                    <div className="mb-2 text-xs text-slate-500">
                      {e.questions.length} question{e.questions.length === 1 ? "" : "s"}{e.anonymous ? "" : ` · pass ${e.passThreshold}%`}
                    </div>
                    <Button className="w-full justify-center" onClick={() => setTaking(e)}>
                      {e.anonymous ? "Start form" : "Take exam"}
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )
      )}

      {tab === "submissions" && reviewer && (
        <SubmissionsTab exams={exams} submissions={submissions} user={user} config={config} onReview={reviewSubmission} />
      )}

      {tab === "members" && reviewer && (
        <MembersTab exams={exams} submissions={submissions} user={user} config={config} onReview={reviewSubmission} />
      )}

      {tab === "manage" && isManager && (
        exams.length === 0 ? (
          <EmptyState icon={Pencil} title="No exams yet" subtitle="Create your first exam." action={<Button icon={Plus} onClick={() => setEditing(blankExam())}>New exam</Button>} />
        ) : (
          <div className="grid gap-2">
            {exams.map((e) => (
              <Panel key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">{e.title}</span>
                    {e.published ? <Badge color="#1eb854">Published</Badge> : <Badge>Draft</Badge>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {e.questions.length} question{e.questions.length === 1 ? "" : "s"} · pass {e.passThreshold}% ·
                    {" "}take: {e.submitTier ? `${groups.find((g) => g.id === e.submitTier)?.label || e.submitTier}+` : "anyone"} ·
                    {" "}review: {e.reviewTier ? `${groups.find((g) => g.id === e.reviewTier)?.label || e.reviewTier}+` : "managers"}
                  </div>
                </div>
                <IconButton icon={Link2} label="Copy link"
                  onClick={() => { try { navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?exam=${e.id}`); show("Link copied"); } catch { show("Couldn't copy"); } }} />
                <IconButton icon={e.published ? Eye : EyeOff} label={e.published ? "Unpublish" : "Publish"}
                  onClick={() => setExams(exams.map((x) => (x.id === e.id ? { ...x, published: !x.published } : x)))} />
                <IconButton icon={Copy} label="Duplicate"
                  onClick={() => setExams([...exams, { ...e, id: uid("exam"), title: `${e.title} (copy)`, published: false, questions: e.questions.map((q) => ({ ...q, id: uid("q") })) }])} />
                <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(e)} />
                <IconButton icon={Trash2} label="Delete" onClick={() => setConfirmDel(e)} className="hover:border-red-500/40 hover:text-red-300" />
              </Panel>
            ))}
          </div>
        )
      )}

      {takingM.data && (
        <TakeExamModal key={takingM.key} open={takingM.open} onClose={() => setTaking(null)} exam={takingM.data} user={user} onSubmit={submitExam} />
      )}
      <ResultModal open={Boolean(result)} onClose={() => setResult(null)} result={result} />
      {editingM.data && (
        <ExamEditor key={editingM.key} open={editingM.open} onClose={() => setEditing(null)} exam={editingM.data} groups={groups} onSave={saveExam} />
      )}
      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Delete this exam?"
        message={`Delete “${confirmDel?.title}”? Its ${submissions.filter((s) => s.examId === confirmDel?.id).length} submission(s) stay in the record.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => { setExams(exams.filter((e) => e.id !== confirmDel.id)); setConfirmDel(null); }}
      />
      {toast && <Toast message={toast} />}
    </div>
  );
}
