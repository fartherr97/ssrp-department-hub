/*
 * The Help Assistant "brain" — a free, fully client-side guided helper. It does
 * NOT call any AI service: it matches a typed question against the how-to flows
 * and the glossary (helpContent.js) and returns the best walkthrough. Being
 * deterministic and offline, it costs nothing and cannot leak anything it wasn't
 * given — and any security-flavored question is deflected outright.
 */
import { GLOSSARY, HOW_TO } from "./helpContent.js";

// Questions we refuse: probing how the site is secured, credentials, or attack
// techniques. Kept deliberately NARROW so ordinary feature words — "access",
// "admin", "role", "login", "permission" — are NOT caught (those are normal
// Access & Roles questions the assistant should happily answer).
const SECURITY_PATTERNS = [
  /\bpasswords?\b/, /\bpassphrase\b/, /\bsecret(s|-key)?\b/, /\btokens?\b/, /\bapi[\s-]?keys?\b/,
  /\bsession secret\b/, /\bcookies?\b/, /\benv(ironment)?[\s-]?(var|variable)/, /\bcredentials?\b/,
  /\bsql\b/, /\binjection\b/, /\bxss\b/, /\bcsrf\b/, /\bexploit/, /\bvulnerab/, /\bhack/,
  /\bbypass/, /\bbrute[\s-]?force/, /\bddos\b/, /\bdenial of service\b/, /\bpen(etration)?[\s-]?test/,
  /\bbreach/, /\bprivate[\s-]?key/, /\bjwt\b/, /\bencrypt/, /\bdecrypt/, /\bbackdoor/, /\bmalware/,
  /\bbot[\s-]?(sync[\s-]?)?secret\b/, /\bdatabase (password|url|credential)/, /\bfirewall\b/,
  /\bsteal\b/, /\bsniff/, /\bintercept/, /\bsanitiz/, /\bescap(e|ing) (html|input|output)/,
];

const DEFLECTION =
  "I'm here to help you build and run the hub, so I can't get into anything about " +
  "security, credentials, or how the site is protected. If you have a security " +
  "question or concern, please reach out to your department head or a site administrator.";

const GREETING =
  "Hi! I'm the Hub Assistant. Tell me what you're trying to do — for example " +
  "“how do I add a page”, “change our colors”, “add a rank”, or “link a Discord role” — " +
  "and I'll walk you through it. Here are some things I can help with:";

function isSecurityQuestion(q) {
  return SECURITY_PATTERNS.some((re) => re.test(q));
}

// Flatten glossary terms for keyword search.
const ALL_TERMS = GLOSSARY.flatMap((s) => s.terms.map((t) => ({ ...t, section: s.section })));

// Filler words that appear in half the definitions and must not drive a match.
const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "with", "from", "this", "that", "what", "whats",
  "how", "does", "can", "are", "was", "who", "why", "when", "where", "into", "our", "out",
  "get", "set", "use", "make", "add", "want", "need", "there", "here", "them", "they",
  "all", "any", "one", "page", "hub", "its",
]);

export function searchGlossary(q) {
  const words = q
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (!words.length) return [];
  return ALL_TERMS.map((t) => {
    const hay = `${t.term} ${t.def}`.toLowerCase();
    // Weight a term-name hit far above a definition hit.
    let score = 0;
    for (const w of words) {
      if (t.term.toLowerCase().includes(w)) score += 3;
      else if (hay.includes(w)) score += 1;
    }
    return { t, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

function scoreFlow(q, flow) {
  let score = 0;
  for (const kw of flow.keywords) {
    if (q.includes(kw)) score += kw.includes(" ") ? 3 : 2; // phrase match counts more
  }
  // Also credit the title words.
  for (const w of flow.title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length > 3 && q.includes(w)) score += 1;
  }
  return score;
}

export const TOPICS = HOW_TO.map((t) => ({ id: t.id, title: t.title }));

/*
 * Turn a typed question into a structured reply the UI renders. Kinds:
 *   greeting | deflect | steps | define | fallback
 */
export function respond(raw) {
  const q = String(raw || "").toLowerCase().trim();
  if (!q) return { kind: "greeting", body: GREETING, topics: TOPICS };

  if (isSecurityQuestion(q)) return { kind: "deflect", body: DEFLECTION };

  if (/^(hi|hello|hey|yo|help|hola|start|what can you do|who are you|topics|menu)\b/.test(q)) {
    return { kind: "greeting", body: GREETING, topics: TOPICS };
  }

  const flows = HOW_TO.map((f) => ({ f, score: scoreFlow(q, f) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (flows.length) {
    const best = flows[0].f;
    const related = flows.slice(1, 4).map((x) => ({ id: x.f.id, title: x.f.title }));
    return { kind: "steps", title: best.title, steps: best.steps, related };
  }

  const defs = searchGlossary(q).slice(0, 3);
  if (defs.length) return { kind: "define", terms: defs };

  return {
    kind: "fallback",
    body:
      "I'm not sure about that one yet. I can walk you through things like pages, " +
      "colors, ranks, roster columns, groups, the chain of command, the calendar, and " +
      "backups. Pick a topic below or try rephrasing.",
    topics: TOPICS,
  };
}

// For the quick-suggestion chips: the how-to id → its full flow (to answer a chip click).
export function flowById(id) {
  const f = HOW_TO.find((x) => x.id === id);
  if (!f) return null;
  return { kind: "steps", title: f.title, steps: f.steps, related: [] };
}
