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
  userLevel,
  groupLevel,
} from "./permissions.js";

// The question palette, Google-Forms style. `auto` = can machine-grade (some,
// like scale/date, only auto-grade when an answer key is set, else they defer to
// a reviewer). `grid` types collect a value per row.
export const QUESTION_TYPES = [
  { type: "short", label: "Short answer", auto: true, hasOptions: false },
  { type: "paragraph", label: "Paragraph", auto: false, hasOptions: false },
  { type: "multiple", label: "Multiple choice", auto: true, hasOptions: true },
  { type: "checkboxes", label: "Checkboxes", auto: true, hasOptions: true },
  { type: "dropdown", label: "Dropdown", auto: true, hasOptions: true },
  { type: "truefalse", label: "True / False", auto: true, hasOptions: false },
  { type: "scale", label: "Linear scale", auto: true, hasOptions: false },
  { type: "rating", label: "Rating", auto: true, hasOptions: false },
  { type: "mcgrid", label: "Multiple-choice grid", auto: true, hasOptions: false },
  { type: "cbgrid", label: "Checkbox grid", auto: true, hasOptions: false },
  { type: "date", label: "Date", auto: true, hasOptions: false },
  { type: "time", label: "Time", auto: true, hasOptions: false },
];
export const isGrid = (type) => type === "mcgrid" || type === "cbgrid";

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
  } else if (type === "scale") {
    q.scaleMin = 1;
    q.scaleMax = 5;
    q.minLabel = "";
    q.maxLabel = "";
    q.correct = ""; // blank = ungraded survey field
  } else if (type === "rating") {
    q.ratingMax = 5;
    q.correct = "";
  } else if (type === "mcgrid" || type === "cbgrid") {
    q.rows = ["Row 1", "Row 2"];
    q.columns = ["Column 1", "Column 2"];
    q.correct = {}; // { [rowLabel]: colLabel } or { [rowLabel]: [colLabels] }
  } else if (type === "date" || type === "time") {
    q.correct = ""; // blank = ungraded
  }
  return q;
}

export function blankExam() {
  return {
    id: localId("exam"),
    title: "New Exam",
    description: "", // supports \n newlines and **bold**
    banner: "", // header image URL
    resourceLinks: [], // [{ label, url }] shown as buttons on the form
    completionMessage: "", // shown after submitting (blank = default)
    passThreshold: 80,
    submitTier: "", // group id; that group AND ABOVE may take it. "" = anyone signed in
    reviewTier: "", // group id; that group AND ABOVE may review. "" = site managers only
    roleId: "", // optional Discord role gate
    roleBypass: true, // true: role OR rank; false: role AND rank
    anonymous: false, // no name/Discord recorded (surveys/feedback)
    scramble: false, // randomize question order per attempt
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

  // scale / rating / date / time: auto-grade only if an answer key is set;
  // otherwise they're survey fields (0 points) or deferred to a reviewer.
  if (t === "scale" || t === "rating" || t === "date" || t === "time") {
    const key = question.correct;
    if (key === undefined || key === null || key === "") {
      return max > 0
        ? { awarded: 0, max, needsReview: true, correct: null }
        : { awarded: 0, max: 0, needsReview: false, correct: null };
    }
    const ok = norm(value) === norm(key);
    return { awarded: ok ? max : 0, max, needsReview: false, correct: ok };
  }

  // grids: all-or-nothing across every row.
  if (t === "mcgrid" || t === "cbgrid") {
    const rows = question.rows || [];
    const key = question.correct || {};
    const hasKey = Object.keys(key).length > 0;
    if (!hasKey) {
      return max > 0
        ? { awarded: 0, max, needsReview: true, correct: null }
        : { awarded: 0, max: 0, needsReview: false, correct: null };
    }
    const val = value || {};
    let ok;
    if (t === "mcgrid") {
      ok = rows.every((r) => norm(val[r]) === norm(key[r]));
    } else {
      ok = rows.every((r) => {
        const want = new Set((key[r] || []).map(norm));
        const got = new Set((Array.isArray(val[r]) ? val[r] : []).map(norm));
        return want.size === got.size && [...want].every((w) => got.has(w));
      });
    }
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
// Rank-tier gating, mirroring the Staff Hub's "Administrator+" style: a setting
// names a group, and that group AND EVERY GROUP ABOVE IT (higher level) qualifies.
// Site managers can always manage, take, and review.

export function canManageExams(user, config) {
  return canManageSite(user, config);
}

// Does the user's group level meet the tier (a group id, meaning "this group and
// above")? An empty tier means no floor — anyone qualifies.
export function meetsTier(user, config, groupId) {
  if (!groupId) return true;
  return userLevel(user, config) >= groupLevel(config, groupId);
}

// May take/submit this exam. Optional Discord-role gate: with roleBypass the role
// OR the rank qualifies; without it, both are required. (Role checks need the
// session to carry the member's roleIds — see buildSessionUser.)
export function canTakeExam(user, config, exam) {
  if (!user || !exam) return false;
  if (canManageSite(user, config)) return true;
  if (!exam.published) return false;
  const tierOk = meetsTier(user, config, exam.submitTier);
  if (!exam.roleId) return tierOk;
  const hasRole = (user.roleIds || []).map(String).includes(String(exam.roleId));
  return exam.roleBypass ? tierOk || hasRole : tierOk && hasRole;
}

// May review/grade submissions for this exam. Empty reviewTier = managers only.
export function canReviewExam(user, config, exam) {
  if (!user || !exam) return false;
  if (canManageSite(user, config)) return true;
  if (!exam.reviewTier) return false;
  return meetsTier(user, config, exam.reviewTier);
}

// Can this user review submissions for ANY exam on the page (drives whether the
// "Submissions" tab shows at all)?
export function canReviewAny(user, config, exams) {
  return (exams || []).some((e) => canReviewExam(user, config, e));
}
