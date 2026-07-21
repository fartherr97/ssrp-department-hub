/*
 * Response assistant — a local, dependency-free summarizer for exam/feedback
 * form responses. It does NOT call any AI service: it reads the aggregated
 * responses in the browser and answers plain-English questions with simple
 * heuristics (overall summary, common themes, or a keyword search over the
 * written answers). Free, instant, and private.
 */
import { aggregateResponses } from "./exams.js";

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "on",
  "for", "with", "at", "by", "it", "this", "that", "they", "them", "our", "we", "you", "i",
  "he", "she", "as", "be", "been", "have", "has", "had", "do", "does", "did", "not", "no",
  "yes", "so", "if", "then", "than", "too", "very", "just", "more", "most", "some", "any",
  "all", "can", "could", "would", "should", "about", "from", "up", "out", "get", "got",
  "really", "also", "what", "did", "people", "say", "said", "think", "feel", "feedback",
  "response", "responses", "everyone", "their", "there", "here", "who", "how", "many",
]);

const words = (s) => String(s || "").toLowerCase().match(/[a-z0-9']+/g) || [];

// Top words by frequency across a set of text answers, ignoring stop words.
function topWords(items, k) {
  const freq = new Map();
  for (const t of items) {
    for (const w of new Set(words(t))) {
      if (w.length < 3 || STOP.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
}

// One human line summarizing a single question's aggregate.
function lineForQuestion(entry, i) {
  const { question, summary } = entry;
  const label = `Q${i + 1} — ${question.prompt || "(untitled)"}:`;
  if (summary.kind === "choice") {
    const entries = Object.entries(summary.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `${label} no answers yet.`;
    const parts = entries.map(([k, n]) => `${k} ${summary.total ? Math.round((n / summary.total) * 100) : 0}% (${n})`);
    return `${label} ${parts.join(", ")}.`;
  }
  if (summary.kind === "numeric") {
    return `${label} average ${summary.avg.toFixed(1)} out of ${summary.max}, from ${summary.total} response${summary.total === 1 ? "" : "s"}.`;
  }
  // text
  const n = summary.items.length;
  let line = `${label} ${n} written answer${n === 1 ? "" : "s"}.`;
  const th = topWords(summary.items, 3);
  if (th.length) line += ` Common words: ${th.map(([w, c]) => `${w} (${c})`).join(", ")}.`;
  return line;
}

function overall(agg, total) {
  const lines = [`${total} response${total === 1 ? "" : "s"} so far.`, ""];
  agg.forEach((entry, i) => lines.push(lineForQuestion(entry, i)));
  return lines.join("\n");
}

// Gather every free-text answer with its question index.
function textEntries(agg) {
  const out = [];
  agg.forEach((entry, i) => {
    if (entry.summary.kind === "text") {
      entry.summary.items.forEach((t) => out.push({ i, prompt: entry.question.prompt, text: t }));
    }
  });
  return out;
}

function themes(agg, total) {
  const texts = textEntries(agg).map((e) => e.text);
  if (!texts.length) {
    return `There are ${total} response${total === 1 ? "" : "s"}, but no written comments to pull themes from. Here's the summary:\n\n${overall(agg, total)}`;
  }
  const top = topWords(texts, 8);
  const lines = ["Most common words across the written answers:", ""];
  top.forEach(([w, c]) => lines.push(`  • ${w} — mentioned in ${c} answer${c === 1 ? "" : "s"}`));
  lines.push("", "A few representative comments:");
  texts.slice(0, 3).forEach((t) => lines.push(`  • “${t}”`));
  return lines.join("\n");
}

function topicSearch(agg, total, qWords) {
  const out = [];
  // Questions whose prompt matches the keywords → include their stats.
  agg.forEach((entry, i) => {
    const prompt = (entry.question.prompt || "").toLowerCase();
    if (qWords.some((w) => prompt.includes(w))) out.push(lineForQuestion(entry, i));
  });
  // Written answers mentioning the keywords → quote them.
  const matches = textEntries(agg).filter(({ text }) => {
    const t = text.toLowerCase();
    return qWords.some((w) => t.includes(w));
  });
  if (matches.length) {
    if (out.length) out.push("");
    out.push(`${matches.length} answer${matches.length === 1 ? "" : "s"} mentioned that:`);
    matches.slice(0, 6).forEach((m) => out.push(`  • “${m.text}”`));
  }
  if (!out.length) {
    return `I couldn't find responses mentioning “${qWords.join(", ")}”. Here's the overall summary instead:\n\n${overall(agg, total)}`;
  }
  return out.join("\n");
}

export function answerQuestion(exam, submissions, question) {
  const subs = (submissions || []).filter((s) => !s.deleted && s.examId === exam.id);
  const total = subs.length;
  if (!total) return "There are no responses yet — check back once people have submitted the form.";
  const agg = aggregateResponses(exam, submissions);
  const q = String(question || "").toLowerCase().trim();
  const qWords = words(q).filter((w) => w.length > 2 && !STOP.has(w));

  if (/\b(theme|themes|common|topics?|trend|recurring|mention)\b/.test(q)) return themes(agg, total);
  if (!qWords.length || /\b(summar|overall|overview|results?|recap|tl;?dr|general|how did)\b/.test(q)) {
    return overall(agg, total);
  }
  return topicSearch(agg, total, qWords);
}
