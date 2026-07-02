/*
 * Exams — a Google-Forms-style assessment system (FTO exams, quizzes, etc.).
 *
 * Data model (config-driven, mirrors the admin-log pattern). An "exam center"
 * page holds many exams; submissions are stored on the page too, snapshotting the
 * questions at submit time so later edits never rewrite a graded record.
 *
 *   exam:       { id, title, description, passThreshold, submitGroups[],
 *                 reviewGroups[], published, questions: [question] }
 *   question:   { id, type, prompt, required, points, options?, correct?, matchMode? }
 *   submission: { id, examId, examTitle, subject:{name,discordId}, by:{name,discordId},
 *                 answers:{ [questionId]: value }, graded:[…], score, maxScore,
 *                 percent, status, at, reviewedBy?, reviewedAt? }
 *
 * Grading: objective types auto-grade against `correct`; paragraph answers are
 * flagged for a human reviewer. Everything here is pure so it's unit-testable and
 * identical on the client and (later) the server.
 */
import {
  canManageSite,
  userGroup,
} from "./permissions.js";

// The question palette, Google-Forms style. `auto` = machine-gradable.
export const QUESTION_TYPES = [
  { type: "multiple", label: "Multiple choice (one answer)", auto: true, hasOptions: true },
  { type: "checkboxes", label: "Checkboxes (multiple answers)", auto: true, hasOptions: true },
  { type: "dropdown", label: "Dropdown", auto: true, hasOptions: true },
  { type: "truefalse", label: "True / False", auto: true, hasOptions: false },
  { type: "short", label: "Short answer", auto: true, hasOptions: false },
  { type: "paragraph", label: "Paragraph (reviewed by a person)", auto: false, hasOptions: false },
];

export function isAutoGradable(type) {
  return QUESTION_TYPES.find((t) => t.type === type)?.auto ?? false;
}
export function typeHasOptions(type) {
  return QUESTION_TYPES.find((t) => t.type === type)?.hasOptions ?? false;
}

let _seq = 0;
function localId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}-${(_seq++).toString(36)}-${Date.now().toString(36)}`;
}

export function blankQuestion(type = "multiple") {
  const q = { id: localId("q"), type, prompt: "", required: true, points: 1 };
  if (typeHasOptions(type)) {
    q.options = ["Option 1", "Option 2"];
    q.correct = type === "checkboxes" ? [] : "";
  } else if (type === "truefalse") {
    q.correct = "True";
  } else if (type === "short") {
    q.correct = [];
    q.matchMode = "exact"; // "exact" | "keywords"
  }
  return q;
}

export function blankExam() {
  return {
    id: localId("exam"),
    title: "New Exam",
    description: "",
    passThreshold: 80,
    submitGroups: [], // empty = any signed-in member may take it
    reviewGroups: [], // empty = site managers only
    published: false,
    questions: [blankQuestion("multiple")],
  };
}

// ── Grading ──────────────────────────────────────────────────────────────────

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Grade one answer. Returns { awarded, max, needsReview, correct }.
//   correct: true/false for auto types, null when it needs a human.
export function gradeAnswer(question, value) {
  const max = Number(question.points) || 0;
  const t = question.type;

  if (t === "paragraph") {
    return { awarded: 0, max, needsReview: true, correct: null };
  }

  if (t === "multiple" || t === "dropdown") {
    const ok = value != null && norm(value) === norm(question.correct);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (t === "truefalse") {
    const ok = norm(value) === norm(question.correct);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (t === "checkboxes") {
    const want = new Set((question.correct || []).map(norm));
    const got = new Set((Array.isArray(value) ? value : []).map(norm));
    const ok = want.size === got.size && [...want].every((w) => got.has(w));
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  if (t === "short") {
    const accepted = (question.correct || []).map(norm).filter(Boolean);
    const v = norm(value);
    let ok = false;
    if (!accepted.length) {
      // No answer key set → can't auto-grade; defer to a reviewer.
      return { awarded: 0, max, needsReview: true, correct: null };
    }
    if (question.matchMode === "keywords") ok = accepted.every((k) => v.includes(k));
    else ok = accepted.some((a) => a === v);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  return { awarded: 0, max, needsReview: false, correct: false };
}

// Grade a whole submission. `answers` is a { questionId: value } map.
export function gradeSubmission(exam, answers = {}) {
  const graded = (exam.questions || []).map((q) => {
    const res = gradeAnswer(q, answers[q.id]);
    return { questionId: q.id, ...res };
  });
  const score = graded.reduce((s, g) => s + g.awarded, 0);
  const maxScore = graded.reduce((s, g) => s + g.max, 0);
  const needsReview = graded.some((g) => g.needsReview);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const threshold = Number(exam.passThreshold) || 0;
  const status = needsReview ? "needs-review" : percent >= threshold ? "passed" : "failed";
  return { graded, score, maxScore, needsReview, percent, status };
}

// Recompute a submission after a reviewer has scored the flagged (paragraph)
// answers: `overrides` is { questionId: awardedPoints }.
export function applyReview(exam, submission, overrides = {}) {
  const graded = (submission.graded || []).map((g) =>
    g.questionId in overrides
      ? { ...g, awarded: Math.max(0, Math.min(g.max, Number(overrides[g.questionId]) || 0)), needsReview: false }
      : g
  );
  const score = graded.reduce((s, g) => s + g.awarded, 0);
  const maxScore = graded.reduce((s, g) => s + g.max, 0);
  const needsReview = graded.some((g) => g.needsReview);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const threshold = Number(exam.passThreshold) || 0;
  const status = needsReview ? "needs-review" : percent >= threshold ? "passed" : "failed";
  return { ...submission, graded, score, maxScore, needsReview, percent, status };
}

// ── Permissions ──────────────────────────────────────────────────────────────
// Gated by permission groups (the app's access model). Site managers can always
// manage, take, and review; that mirrors how every other admin surface behaves.

export function canManageExams(user, config) {
  return canManageSite(user, config);
}

function inGroups(user, config, groupIds) {
  if (!groupIds || groupIds.length === 0) return true; // empty = everyone signed in
  const g = userGroup(config, user);
  return !!g && groupIds.includes(g.id);
}

// May take/submit this exam.
export function canTakeExam(user, config, exam) {
  if (!user || !exam) return false;
  if (canManageSite(user, config)) return true;
  if (!exam.published) return false;
  return inGroups(user, config, exam.submitGroups);
}

// May review/grade submissions for this exam.
export function canReviewExam(user, config, exam) {
  if (!user || !exam) return false;
  if (canManageSite(user, config)) return true;
  const g = userGroup(config, user);
  return !!g && (exam.reviewGroups || []).includes(g.id);
}

// Can this user review submissions for ANY exam on the page (drives whether the
// "Submissions" tab shows at all)?
export function canReviewAny(user, config, exams) {
  return (exams || []).some((e) => canReviewExam(user, config, e));
}
