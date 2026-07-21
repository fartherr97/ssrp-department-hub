import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, GraduationCap, ClipboardList, Search, Check, X,
  CircleCheck, CircleX, Clock, FileText, Eye, EyeOff, Copy, ExternalLink, Link2, Users, RotateCcw,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { answerQuestion } from "../lib/responsesAssistant.js";
import { safeLinkUrl, safeMediaUrl } from "../lib/urls.js";
import {
  Panel, PageHeader, SectionHeader, Button, IconButton, Field, Input, Select,
  Textarea, Badge, EmptyState, Modal, ConfirmDialog, useModalData, Toast, CommaListInput,
} from "../components/common/index.jsx";
import {
  QUESTION_TYPES, blankExam, blankQuestion, typeHasOptions,
  gradeSubmission, applyReview, canManageExams, canTakeExam, canReviewExam, canReviewAny,
  isFeedbackExam, asFeedbackExam, aggregateResponses,
} from "../lib/exams.js";
import { BarChart3, MessageSquareText, Sparkles, Layers } from "lucide-react";

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
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

// A submission's result bucket: survey / feedback form (no gradable points) →
// "noscore". Treat a missing maxScore the same, so a survey or legacy submission
// never shows as a "Fail".
const resultOf = (s) => (!s.maxScore ? "noscore" : s.status === "needs-review" ? "review" : s.status === "passed" ? "passed" : "failed");
const RESULT_META = {
  passed: { label: "Pass", color: "#1eb854" },
  failed: { label: "Fail", color: "#ef4444" },
  review: { label: "Needs Review", color: "#f59e0b" },
  noscore: { label: "No Score", color: "#64748b" },
};
function ResultPill({ s }) {
  const m = RESULT_META[resultOf(s)];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ borderColor: `${m.color}44`, color: m.color, background: `${m.color}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
    </span>
  );
}

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

function AnswerInput({ q, value, onChange, readOnly = false }) {
  // In read-only mode (reviewing a submission) the whole widget is rendered
  // exactly as it looked on the form, but clicks/edits do nothing.
  if (readOnly) onChange = () => {};
  const ro = readOnly
    ? { readOnly: true, tabIndex: -1 }
    : {};
  if (q.type === "paragraph")
    return <Textarea rows={4} value={value || ""} {...ro} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "short")
    return <Input value={value || ""} {...ro} onChange={(e) => onChange(e.target.value)} placeholder={readOnly ? "" : "Your answer"} />;
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
    return <Input type="date" value={value || ""} {...ro} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "time")
    return <Input type="time" value={value || ""} {...ro} onChange={(e) => onChange(e.target.value)} />;
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
  const [err, setErr] = useState("");
  const set = (qid, v) => setAnswers((a) => ({ ...a, [qid]: v }));

  // Identity auto-pulls from the Discord session: since everyone signs in with
  // Discord, a non-anonymous submission is always tied to the signed-in user's
  // display name and Discord ID. Anonymous forms record neither.
  const identity = exam.anonymous
    ? { name: "Anonymous", discordId: "" }
    : { name: who(user), discordId: String(user?.id || "") };

  // Auto-save progress as they go (Staff Hub style).
  useEffect(() => {
    if (exam.anonymous) return; // don't persist anonymous responses
    try { localStorage.setItem(progressKey(exam.id), JSON.stringify({ answers })); } catch { /* quota */ }
  }, [answers, exam.id, exam.anonymous]);
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
    // Non-anonymous submissions must be tied to the signed-in Discord user.
    if (!exam.anonymous && !identity.discordId) {
      setErr("You need to be signed in with Discord to submit this.");
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
    onSubmit(exam, answers, identity);
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
          <Button onClick={submit}>{isFeedbackExam(exam) ? "Submit form" : "Submit exam"}</Button>
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
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-slate-300">
              {(identity.name || "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Submitting as {identity.name}</div>
              <div className="truncate font-mono text-xs text-slate-500">{identity.discordId || "no Discord ID on file"}</div>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {exam.anonymous ? "Anonymous, your name and Discord ID are not recorded. " : `Pass mark ${exam.passThreshold}%. Pulled from your Discord login. `}
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

// Review state for one submission, shared between the detail body (which shows
// per-question award inputs) and the action buttons (which can live in a modal
// footer). Kept in a hook so both render from the same source of truth.
function useReview(submission, canReview) {
  // Any question worth points is gradable. A "manual" one couldn't be
  // auto-decided (paragraph or an un-keyed field), so it needs a human on the
  // first pass. Re-grading lets a reviewer override ANY gradable question.
  const gradable = (submission.graded || []).filter((g) => g.max > 0);
  const noScore = !submission.maxScore; // survey / feedback form: nothing to grade
  const pending = gradable.some((g) => g.needsReview);
  const [regrade, setRegrade] = useState(false);
  const editing = canReview && (pending || regrade);
  // While first reviewing, only the manual questions take input; when
  // re-grading, every gradable question is editable.
  const showInput = (g) => editing && g.max > 0 && (regrade || g.correct == null);
  const [awards, setAwards] = useState(() => {
    const o = {};
    gradable.forEach((g) => { o[g.questionId] = g.awarded; });
    return o;
  });
  return { noScore, pending, regrade, setRegrade, editing, showInput, awards, setAwards, canGrade: canReview && !noScore };
}

// The Re-grade / Save / Cancel buttons. Rendered in the modal footer next to
// Close, or inline under the body when there's no footer.
function ReviewActions({ review, submission, onReview }) {
  const { canGrade, editing, pending, regrade, setRegrade, awards } = review;
  if (!canGrade) return null;
  if (!editing) {
    return <Button variant="secondary" icon={Pencil} onClick={() => setRegrade(true)}>Re-grade</Button>;
  }
  return (
    <>
      {regrade && !pending && (
        <Button variant="secondary" onClick={() => setRegrade(false)}>Cancel</Button>
      )}
      <Button onClick={() => { onReview(submission, awards); setRegrade(false); }}>
        {pending ? "Save review & grade" : "Save changes"}
      </Button>
    </>
  );
}

function SubmissionDetail({ submission, review, exam }) {
  const { noScore, showInput, awards, setAwards } = review;
  const gById = (id) => (submission.graded || []).find((g) => g.questionId === id) || {};
  // Old submissions only snapshotted a few fields; fall back to the live exam
  // question so scale bounds, labels, grid rows, etc. still render.
  const liveQ = (id) => (exam?.questions || []).find((x) => x.id === id) || {};

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-white">{submission.subject?.name || "—"}</span>
        {submission.subject?.discordId && <span className="font-mono text-xs text-slate-500">{submission.subject.discordId}</span>}
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{submission.examTitle}</span>
        <span className="ml-auto flex items-center gap-2">
          {noScore ? (
            <Badge color="#64748b">Not graded</Badge>
          ) : (
            <>
              <span className="text-slate-400">{submission.score}/{submission.maxScore} ({submission.percent}%)</span>
              <StatusBadge s={submission.status} />
            </>
          )}
        </span>
      </div>
      {(submission.questions || []).map((q, i) => {
        const g = gById(q.id);
        const graded = g.max > 0; // a 0-point survey field has no score to show
        const fullQ = { ...liveQ(q.id), ...q }; // snapshot wins, live fills gaps
        const answered = submission.answers?.[q.id];
        const isBlank = answered == null || answered === "" || (Array.isArray(answered) && answered.length === 0);
        return (
          <div key={q.id} className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-white">
                {i + 1}. {q.prompt || <span className="italic text-slate-500">Untitled question</span>}
                {graded && <span className="ml-2 text-xs font-normal text-slate-500">({g.max} pt{g.max === 1 ? "" : "s"})</span>}
              </div>
              {graded && (
                <div className="shrink-0 text-xs text-slate-400">
                  {g.needsReview ? `— / ${g.max}` : `${g.awarded} / ${g.max}`}
                  {!g.needsReview && q.type !== "paragraph" && g.correct != null && (
                    g.correct ? <Check size={13} className="ml-1 inline text-green-400" /> : <X size={13} className="ml-1 inline text-red-400" />
                  )}
                </div>
              )}
            </div>
            {isBlank ? (
              <p className="text-sm italic text-slate-600">No answer</p>
            ) : (
              <div className="pointer-events-none select-none">
                <AnswerInput q={fullQ} value={answered} readOnly />
              </div>
            )}
            {showInput(g) && (
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
    </div>
  );
}

// Full submission modal: body + a footer with the review actions next to Close.
function SubmissionModal({ submission, exam, canReview, onReview, onClose }) {
  const review = useReview(submission, canReview);
  return (
    <Modal open onClose={onClose} title="Submission" size="lg"
      footer={
        <>
          <ReviewActions review={review} submission={submission} onReview={(s, a) => { onReview(s, a); onClose(); }} />
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      }>
      <SubmissionDetail submission={submission} exam={exam} review={review} />
    </Modal>
  );
}

// Inline (non-modal) submission view, e.g. the Members tab accordion.
function SubmissionInline({ submission, exam, canReview, onReview }) {
  const review = useReview(submission, canReview);
  return (
    <>
      <SubmissionDetail submission={submission} exam={exam} review={review} />
      {review.canGrade && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <ReviewActions review={review} submission={submission} onReview={onReview} />
        </div>
      )}
    </>
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

function RecycleBinModal({ deleted, onClose, onRestore, onPurge }) {
  return (
    <Modal open onClose={onClose} title={`Recycle bin (${deleted.length})`} size="lg"
      footer={<Button onClick={onClose}>Done</Button>}>
      {deleted.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">The recycle bin is empty.</p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5">
          {deleted.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{s.subject?.name || "Anonymous"}</div>
                <div className="truncate text-xs text-slate-500">{s.examTitle} · {s.maxScore ? `${s.percent}%` : "—"} · deleted {fmtDateTime(s.deletedAt)}</div>
              </div>
              <ResultPill s={s} />
              <IconButton icon={RotateCcw} label="Restore" onClick={() => onRestore(s.id)} />
              <IconButton icon={Trash2} label="Delete permanently" onClick={() => onPurge(s.id)} className="hover:border-red-500/40 hover:text-red-300" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SubmissionsTab({ exams, submissions, user, config, onReview, onTrash, onPurge, isManager }) {
  const [q, setQ] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [binOpen, setBinOpen] = useState(false);
  const examById = (id) => exams.find((e) => e.id === id);
  const canReviewSub = (s) => {
    const e = examById(s.examId);
    return e ? canReviewExam(user, config, e) : canManageExams(user, config);
  };
  const reviewableExams = exams.filter((e) => canReviewExam(user, config, e));

  const mine = submissions.filter(canReviewSub);
  const live = mine.filter((s) => !s.deleted);
  const deleted = mine.filter((s) => s.deleted);
  const term = q.trim().toLowerCase();
  const matchesTerm = (s) => !term || `${s.subject?.name || ""} ${s.subject?.discordId || ""}`.toLowerCase().includes(term);
  const byNewest = (a, b) => (b.at || "").localeCompare(a.at || "");

  // Submissions for one exam, newest first, honoring the search box.
  const forExam = (id) => live.filter((s) => s.examId === id && matchesTerm(s)).sort(byNewest);

  if (reviewableExams.length === 0) {
    return <EmptyState icon={ClipboardList} title="Nothing to review" subtitle="You don't review submissions for any exam yet." />;
  }

  const selectedExam = examFilter === "all" ? null : examById(examFilter);
  // In the grouped overview each exam shows its 5 most recent; a specific exam
  // shows the full list with the status filter.
  const detailRows = selectedExam
    ? forExam(selectedExam.id).filter((s) => statusFilter === "all" || resultOf(s) === statusFilter)
    : [];
  const statusCounts = selectedExam
    ? {
        all: forExam(selectedExam.id).length,
        review: forExam(selectedExam.id).filter((s) => resultOf(s) === "review").length,
        passed: forExam(selectedExam.id).filter((s) => resultOf(s) === "passed").length,
        failed: forExam(selectedExam.id).filter((s) => resultOf(s) === "failed").length,
        noscore: forExam(selectedExam.id).filter((s) => resultOf(s) === "noscore").length,
      }
    : null;

  const ScoreChip = ({ s }) => (
    <span className="shrink-0 whitespace-nowrap rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs tabular-nums">
      {s.maxScore ? <><b className="text-white">{s.score}</b><span className="text-slate-500"> / {s.maxScore}</span></> : <span className="text-slate-500">—</span>}
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Header, styled like the staff exam backend */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cad-muted">Exam Backend</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-bold text-white">Recent Submissions</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Latest exam submissions, grouped by exam.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatPill icon={ClipboardList} value={live.length} label="Submissions" />
            <StatPill icon={Layers} value={reviewableExams.length} label="Exam types" />
            {isManager && deleted.length > 0 && (
              <Button variant="secondary" icon={Trash2} onClick={() => setBinOpen(true)}>Recycle Bin ({deleted.length})</Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or Discord ID…" className="pl-9" />
          </div>
          <div className="flex flex-1 gap-1 overflow-x-auto">
            <Chip active={examFilter === "all"} onClick={() => setExamFilter("all")}>All Exams</Chip>
            {reviewableExams.map((e) => (
              <Chip key={e.id} active={examFilter === e.id} onClick={() => setExamFilter(e.id)}>{e.title}</Chip>
            ))}
          </div>
        </div>
      </Panel>

      {selectedExam ? (
        /* Single-exam view: full list + status filter */
        <div className="grid grid-cols-1 gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {[["all", "All"], ["review", "Needs Review"], ["passed", "Passed"], ["failed", "Failed"], ["noscore", "No Score"]].map(([k, label]) => (
              <Chip key={k} active={statusFilter === k} onClick={() => setStatusFilter(k)}>{label} ({statusCounts[k]})</Chip>
            ))}
          </div>
          <Panel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Cadet</th>
                    <th className="px-4 py-2.5 font-semibold">Discord ID</th>
                    <th className="px-4 py-2.5 font-semibold">Score</th>
                    <th className="px-4 py-2.5 font-semibold">%</th>
                    <th className="px-4 py-2.5 font-semibold">Submitted</th>
                    <th className="px-4 py-2.5 font-semibold">Result</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((s) => (
                    <tr key={s.id} onClick={() => setDetail(s)} className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 font-semibold text-white">{s.subject?.name || "Anonymous"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.subject?.discordId || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums"><span className="font-semibold text-white">{s.score}</span> <span className="text-slate-500">/ {s.maxScore}</span></td>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-[var(--color-primary)]">{s.maxScore ? `${s.percent}%` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-400">{fmtDateTime(s.at)}</td>
                      <td className="px-4 py-2.5"><ResultPill s={s} /></td>
                      <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isManager && <IconButton icon={Trash2} label="Move to recycle bin" onClick={() => onTrash(s.id, true)} className="h-8 w-8 hover:border-red-500/40 hover:text-red-300" />}
                      </td>
                    </tr>
                  ))}
                  {detailRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">No submissions match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : (
        /* Grouped overview: 5 most recent per exam */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reviewableExams.map((e) => {
            const all = forExam(e.id);
            const recent = all.slice(0, 5);
            const Icon = isFeedbackExam(e) ? MessageSquareText : GraduationCap;
            return (
              <Panel key={e.id} className="flex flex-col overflow-hidden p-0">
                <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[color:var(--color-primary)]/12">
                    <Icon size={16} className="text-[var(--color-primary)]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{e.title}</span>
                  <Badge>{all.length}</Badge>
                </div>
                <div className="flex flex-col divide-y divide-white/5">
                  {recent.map((s) => (
                    <button key={s.id} onClick={() => setDetail(s)}
                      className="flex items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{s.subject?.name || "Anonymous"}</div>
                        <div className="truncate text-xs text-slate-500">{s.subject?.discordId || fmtDateTime(s.at)}</div>
                      </div>
                      <ScoreChip s={s} />
                      <ResultPill s={s} />
                    </button>
                  ))}
                  {recent.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">No submissions.</div>
                  )}
                </div>
                {all.length > recent.length && (
                  <button onClick={() => { setExamFilter(e.id); setStatusFilter("all"); }}
                    className="flex items-center justify-center gap-1.5 border-t border-white/10 px-4 py-2.5 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-white/[0.03]">
                    <Layers size={13} />View all submissions ({all.length})
                  </button>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {detail && (
        <SubmissionModal submission={detail} exam={examById(detail.examId)} canReview={canReviewSub(detail)}
          onReview={onReview} onClose={() => setDetail(null)} />
      )}
      {binOpen && (
        <RecycleBinModal deleted={deleted} onClose={() => setBinOpen(false)} onRestore={(id) => onTrash(id, false)} onPurge={onPurge} />
      )}
    </div>
  );
}

// ── Members (a person's exam history) ────────────────────────────────────────

function MembersTab({ exams, submissions, user, config, onReview }) {
  const [q, setQ] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [openSub, setOpenSub] = useState(null);
  const examById = (id) => exams.find((e) => e.id === id);
  const canReviewSub = (s) => { const e = examById(s.examId); return e ? canReviewExam(user, config, e) : canManageExams(user, config); };

  // Build the member index live (so a review updates the open profile too).
  const reviewable = submissions.filter(canReviewSub).filter((s) => !s.deleted && s.subject?.name && s.subject.name !== "Anonymous");
  const map = new Map();
  for (const s of reviewable) {
    const key = s.subject.discordId || s.subject.name.toLowerCase();
    if (!map.has(key)) map.set(key, { key, name: s.subject.name, discordId: s.subject.discordId, subs: [] });
    map.get(key).subs.push(s);
  }
  for (const p of map.values()) p.subs.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const term = q.trim().toLowerCase();
  const suggestions = term
    ? [...map.values()].filter((p) => `${p.name} ${p.discordId || ""}`.toLowerCase().includes(term)).slice(0, 8)
    : [];
  const selected = selectedKey ? map.get(selectedKey) : null;
  const initials = (n) => (n || "?").slice(0, 2).toUpperCase();

  const pick = (p) => { setSelectedKey(p.key); setQ(""); setOpenSub(null); };

  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); if (selectedKey) setSelectedKey(null); }}
            placeholder="Search a member by name or Discord ID…"
            className="pl-9"
          />
          {term && !selected && (
            <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[var(--color-surface-2)] shadow-xl">
              {suggestions.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-slate-500">No members match “{q.trim()}”.</div>
              ) : (
                suggestions.map((p) => (
                  <button key={p.key} onClick={() => pick(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.05]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-300">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">{p.discordId || "no Discord ID"} · {p.subs.length} exam{p.subs.length === 1 ? "" : "s"}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Panel>

      {!selected ? (
        <EmptyState icon={Users} title="Search for a member" subtitle="Start typing a name or Discord ID, then pick someone to load their exam history." />
      ) : (
        <Panel className="p-0">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-bold text-slate-300">{initials(selected.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">{selected.name}</div>
              <div className="truncate text-xs text-slate-500">
                {selected.discordId || "no Discord ID"} · {selected.subs.length} exam{selected.subs.length === 1 ? "" : "s"} · {selected.subs.filter((s) => s.status === "passed").length} passed
              </div>
            </div>
            <Button variant="secondary" className="!py-1.5 text-xs" onClick={() => { setSelectedKey(null); setQ(""); }}>Change</Button>
          </div>
          <div className="grid gap-2 p-3">
            {selected.subs.map((s) => (
              <div key={s.id} className="rounded-lg border border-white/10 bg-[var(--color-surface-2)]">
                <button onClick={() => setOpenSub(openSub === s.id ? null : s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{s.examTitle}</span>
                  <span className="text-xs text-slate-500">{fmtDate(s.at)}</span>
                  <span className="text-xs text-slate-400">{s.percent}%</span>
                  <StatusBadge s={s.status} />
                </button>
                {openSub === s.id && (
                  <div className="border-t border-white/10 p-3">
                    <SubmissionInline submission={s} exam={examById(s.examId)} canReview={canReviewSub(s)} onReview={onReview} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
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

function QuestionEditor({ q, index, total, onMove, onChange, onDelete, feedback = false }) {
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
            Options {feedback ? "" : q.type === "checkboxes" ? "(tick every correct one)" : "(tick the correct one)"}
          </div>
          {(q.options || []).map((o, i) => {
            const isCorrect = q.type === "checkboxes" ? (q.correct || []).includes(o) : q.correct === o;
            const markCorrect = () =>
              q.type === "checkboxes"
                ? patch({ correct: isCorrect ? q.correct.filter((c) => c !== o) : [...(q.correct || []), o] })
                : patch({ correct: o });
            return (
              <div key={i} className="flex items-center gap-2">
                {!feedback && (
                  <button type="button" onClick={markCorrect} title="Mark correct"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border ${q.type === "checkboxes" ? "rounded" : "rounded-full"} ${isCorrect ? "border-green-500 bg-green-500 text-white" : "border-white/25 text-transparent"}`}>
                    <Check size={12} />
                  </button>
                )}
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

      {!feedback && q.type === "truefalse" && (
        <Field label="Correct answer" className="mt-2">
          <Select value={q.correct} onChange={(e) => patch({ correct: e.target.value })}>
            <option value="True">True</option>
            <option value="False">False</option>
          </Select>
        </Field>
      )}

      {!feedback && q.type === "short" && (
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
          {!feedback && <Field label="Correct value" hint="Blank = ungraded (survey)." className="sm:col-span-2"><Input value={q.correct || ""} onChange={(e) => patch({ correct: e.target.value })} placeholder="e.g. 5" /></Field>}
        </div>
      )}

      {q.type === "rating" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Max stars"><Input type="number" min={2} max={10} value={q.ratingMax ?? 5} onChange={(e) => patch({ ratingMax: Number(e.target.value) })} /></Field>
          {!feedback && <Field label="Correct value" hint="Blank = ungraded."><Input value={q.correct || ""} onChange={(e) => patch({ correct: e.target.value })} placeholder="e.g. 5" /></Field>}
        </div>
      )}

      {!feedback && (q.type === "date" || q.type === "time") && (
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
          {!feedback && (
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
          )}
        </div>
      )}

      {q.type === "paragraph" && (
        <p className="mt-2 text-xs text-slate-500">{feedback ? "Open comment field." : "Graded by a reviewer, no answer key."}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={q.required} onChange={(e) => patch({ required: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
          Required
        </label>
        {!feedback && (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Points
            <Input type="number" min={0} value={q.points} onChange={(e) => patch({ points: Number(e.target.value) || 0 })} className="w-16" />
          </label>
        )}
      </div>
    </div>
  );
}

function ExamEditor({ open, onClose, exam, groups, onSave, onAutoSave }) {
  const [draft, setDraft] = useState(exam);
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const feedback = !!draft.feedback;
  const noun = feedback ? "form" : "exam";

  // Auto-save as you edit (Google-Forms style), with a Saving… / Saved indicator.
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const autoRef = useRef(onAutoSave);
  autoRef.current = onAutoSave;
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; } // skip mount
    if (!draft.title?.trim()) return; // don't persist an untitled draft
    setSaveState("saving");
    const t = setTimeout(() => {
      autoRef.current?.(draft.feedback ? asFeedbackExam(draft) : draft);
      setSaveState("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [draft]);
  // Turning on feedback mode implies anonymous + ungraded by default.
  const toggleFeedback = (on) =>
    setDraft((d) => (on ? { ...asFeedbackExam(d), feedback: true, anonymous: true } : { ...d, feedback: false }));
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
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs">
            {saveState === "saving" ? (
              <span className="text-slate-400">Saving…</span>
            ) : saveState === "saved" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400"><Check size={13} strokeWidth={3} /> Saved</span>
            ) : null}
          </span>
          <Button disabled={!draft.title.trim()} onClick={() => onSave(feedback ? asFeedbackExam(draft) : draft)}>Done</Button>
        </>
      }>
      <div className="grid gap-4">
        <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-[color:var(--color-primary)]/5 p-3 text-sm text-slate-300">
          <input type="checkbox" checked={feedback} onChange={(e) => toggleFeedback(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
          <span>
            <strong className="text-white">Feedback form</strong> — a survey with no grading, scores, or pass mark.
            <span className="text-slate-500"> All questions become open responses; defaults to anonymous. Use the Summary tab to see results.</span>
          </span>
        </label>
        <div className={`grid gap-3 ${feedback ? "" : "sm:grid-cols-[1fr_120px]"}`}>
          <Field label={feedback ? "Form title" : "Exam title"}><Input value={draft.title} onChange={(e) => patch({ title: e.target.value })} autoFocus /></Field>
          {!feedback && (
            <Field label="Pass mark %"><Input type="number" min={0} max={100} value={draft.passThreshold} onChange={(e) => patch({ passThreshold: Number(e.target.value) || 0 })} /></Field>
          )}
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
            Questions ({draft.questions.length}){!feedback && ` · ${total} pts total`}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={draft.published} onChange={(e) => patch({ published: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
            Published (people can {feedback ? "fill it out" : "take it"})
          </label>
        </div>

        <div className="grid gap-2">
          {draft.questions.map((q, i) => (
            <QuestionEditor key={q.id} q={q} index={i} total={draft.questions.length} feedback={feedback} onMove={moveQ}
              onChange={(nq) => setQ(q.id, nq)} onDelete={() => patch({ questions: draft.questions.filter((x) => x.id !== q.id) })} />
          ))}
        </div>
        <Button variant="secondary" icon={Plus} onClick={() => patch({ questions: [...draft.questions, blankQuestion("multiple")] })}>Add question</Button>
      </div>
    </Modal>
  );
}

// ── Summary tab (response aggregation + AI) ──────────────────────────────────

function AggChoice({ counts, total }) {
  const entries = Object.entries(counts);
  return (
    <div className="grid gap-1.5">
      {entries.map(([label, n]) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-slate-300">{label}</span>
                <span className="shrink-0 font-semibold text-slate-400">{n} · {pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      {entries.length === 0 && <p className="text-xs text-slate-500">No options.</p>}
    </div>
  );
}

function AggNumeric({ avg, dist, total, min, max }) {
  const buckets = [];
  for (let i = min; i <= max; i++) buckets.push(i);
  const peak = Math.max(1, ...Object.values(dist));
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-black text-[var(--color-primary)]">{avg.toFixed(1)}</span>
        <span className="text-xs text-slate-500">average · {total} response{total === 1 ? "" : "s"}</span>
      </div>
      <div className="flex items-end gap-1.5">
        {buckets.map((b) => {
          const n = dist[b] || 0;
          return (
            <div key={b} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end">
                <div className="w-full rounded-t bg-[var(--color-primary)]/70" style={{ height: `${(n / peak) * 100}%` }} title={`${n}`} />
              </div>
              <span className="text-[10px] text-slate-500">{b}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AskAI({ exam, submissions }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const ask = (question) => {
    const text = (question ?? q).trim();
    if (!text) return;
    setAnswer(answerQuestion(exam, submissions, text));
  };
  const suggestions = ["Summarize the responses.", "What are the most common themes?", "What did people say about Captains?"];
  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--color-primary)]" />
        <span className="text-sm font-bold text-white">Ask about these responses</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        A built-in assistant reads the responses and answers right here, with no external service, nothing leaves your hub. Try “What did people say about our Captains?”
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => { setQ(s); ask(s); }}
            className="press rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:border-[color:var(--color-border-strong)] hover:text-white">
            {s}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…"
          onKeyDown={(e) => e.key === "Enter" && ask()} className="flex-1" />
        <Button icon={MessageSquareText} disabled={!q.trim()} onClick={() => ask()}>Ask</Button>
      </div>
      {answer && (
        <div className="mt-3 whitespace-pre-line rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 text-sm leading-6 text-slate-200">
          {answer}
        </div>
      )}
    </Panel>
  );
}

function SummaryTab({ exams, submissions, user, config }) {
  const reviewable = exams.filter((e) => canReviewExam(user, config, e));
  const [examId, setExamId] = useState(reviewable[0]?.id || "");
  const exam = reviewable.find((e) => e.id === examId) || reviewable[0];
  if (!reviewable.length) {
    return <EmptyState icon={BarChart3} title="Nothing to summarize" subtitle="You don't review submissions for any exam or form yet." />;
  }
  const subs = submissions.filter((s) => !s.deleted && s.examId === exam.id);
  const agg = aggregateResponses(exam, submissions);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={exam.id} onChange={(e) => setExamId(e.target.value)} className="max-w-xs">
          {reviewable.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
        <Badge>{subs.length} response{subs.length === 1 ? "" : "s"}</Badge>
        {isFeedbackExam(exam) && <Badge color="#a855f7">Feedback form</Badge>}
      </div>

      <AskAI exam={exam} submissions={submissions} />

      {subs.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No responses yet" subtitle="Aggregates appear here once people respond." />
      ) : (
        <div className="grid gap-3">
          {agg.map(({ question, answered, summary }, i) => (
            <Panel key={question.id} className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  <span className="text-slate-500">Q{i + 1}. </span>{question.prompt || "(untitled)"}
                </div>
                <span className="shrink-0 text-xs text-slate-500">{answered} answered</span>
              </div>
              {summary.kind === "choice" && <AggChoice counts={summary.counts} total={summary.total} />}
              {summary.kind === "numeric" && <AggNumeric avg={summary.avg} dist={summary.dist} total={summary.total} min={summary.min} max={summary.max} />}
              {summary.kind === "text" && (
                summary.items.length === 0 ? (
                  <p className="text-xs text-slate-500">No answers.</p>
                ) : (
                  <div className="grid max-h-64 gap-1.5 overflow-y-auto">
                    {summary.items.map((t, j) => (
                      <div key={j} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-300">{t}</div>
                    ))}
                  </div>
                )
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
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
  if (reviewer) TABS.push({ id: "summary", label: "Summary", icon: BarChart3 });
  if (reviewer) TABS.push({ id: "members", label: "Members", icon: Users });
  if (isManager) TABS.push({ id: "manage", label: "Exam Editor", icon: Pencil });
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
      // Snapshot the full question (minus the answer key) so the review can
      // render the exact same widgets the form used, even if the exam changes.
      questions: (exam.questions || []).map(({ correct, ...q }) => q),
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
    setEditing(null);
  }
  // Auto-save: upsert the exam into config as it's edited (no toast, no close),
  // driven by mutate so rapid edits don't race a stale `exams` snapshot.
  function autoSaveExam(draft) {
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) => {
        if (p.id !== page.id) return p;
        const list = p.config?.exams || [];
        const next = list.some((e) => e.id === draft.id)
          ? list.map((e) => (e.id === draft.id ? draft : e))
          : [...list, draft];
        return { ...p, config: { ...(p.config || {}), exams: next } };
      }),
    }));
  }

  // Soft-delete a submission to the recycle bin, and restore/purge from it.
  function trashSubmission(id, deleted) {
    setSubmissions(submissions.map((s) => (s.id === id ? { ...s, deleted, deletedAt: deleted ? new Date().toISOString() : undefined } : s)));
    show(deleted ? "Moved to recycle bin" : "Restored");
  }
  function purgeSubmission(id) {
    setSubmissions(submissions.filter((s) => s.id !== id));
    show("Deleted permanently");
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

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {TABS.length > 1 && (
          <nav className="lg:w-56 lg:shrink-0">
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-1.5 lg:flex-col lg:gap-0.5">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition lg:w-full ${tab === t.id ? "bg-[color:var(--color-primary)]/20 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                  <t.icon size={16} className={`shrink-0 ${tab === t.id ? "text-[var(--color-primary)]" : ""}`} />{t.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <div className="min-w-0 flex-1">
        <div key={tab} className="animate-pageFade">
      {tab === "take" && (
        takeable.length === 0 ? (
          <EmptyState icon={FileText} title="No exams available" subtitle={isManager ? "Create one under Exam Editor, then publish it." : "Nothing has been assigned to you yet."} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {takeable.map((e) => (
              <Panel key={e.id} className="hub-card-hover group flex flex-col overflow-hidden p-0">
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
        <SubmissionsTab exams={exams} submissions={submissions} user={user} config={config}
          onReview={reviewSubmission} onTrash={trashSubmission} onPurge={purgeSubmission} isManager={isManager} />
      )}

      {tab === "summary" && reviewer && (
        <SummaryTab exams={exams} submissions={submissions} user={user} config={config} />
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
        </div>
        </div>
      </div>

      {takingM.data && (
        <TakeExamModal key={takingM.key} open={takingM.open} onClose={() => setTaking(null)} exam={takingM.data} user={user} onSubmit={submitExam} />
      )}
      <ResultModal open={Boolean(result)} onClose={() => setResult(null)} result={result} />
      {editingM.data && (
        <ExamEditor key={editingM.key} open={editingM.open} onClose={() => setEditing(null)} exam={editingM.data} groups={groups} onSave={saveExam} onAutoSave={autoSaveExam} />
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
