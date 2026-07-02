import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Send, Sparkles, ListChecks, BookOpen, ShieldAlert } from "lucide-react";
import { Panel, PageHeader, SectionHeader, Input, Button } from "../components/common/index.jsx";
import { GLOSSARY } from "../lib/helpContent.js";
import { respond, flowById, TOPICS } from "../lib/helpAssistant.js";

// ── Assistant ────────────────────────────────────────────────────────────────

function AssistantReply({ reply }) {
  if (reply.kind === "deflect") {
    return (
      <div className="flex items-start gap-2 text-sm text-amber-200/90">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="leading-relaxed">{reply.body}</p>
      </div>
    );
  }
  if (reply.kind === "steps") {
    return (
      <div className="text-sm">
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-white">
          <ListChecks size={15} className="text-[var(--color-primary)]" />
          {reply.title}
        </div>
        <ol className="ml-1 grid gap-1.5">
          {reply.steps.map((s, i) => (
            <li key={i} className="flex gap-2 leading-relaxed text-slate-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)]/20 text-[10px] font-bold text-[var(--color-primary)]">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {reply.related?.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Related:</span>
            {reply.related.map((r) => (
              <TopicChip key={r.id} topic={r} small />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (reply.kind === "define") {
    return (
      <div className="grid gap-2 text-sm">
        {reply.terms.map((t) => (
          <div key={t.term}>
            <div className="font-semibold text-white">{t.term}</div>
            <div className="leading-relaxed text-slate-400">{t.def}</div>
          </div>
        ))}
      </div>
    );
  }
  // greeting | fallback
  return (
    <div className="text-sm">
      <p className="leading-relaxed text-slate-300">{reply.body}</p>
      {reply.topics?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {reply.topics.map((t) => (
            <TopicChip key={t.id} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// A clickable suggestion; `onPick` is injected via context-free prop drilling
// through a module-level handler set by the Assistant (kept simple here).
let pickHandler = null;
function TopicChip({ topic, small }) {
  return (
    <button
      type="button"
      onClick={() => pickHandler?.(topic.id)}
      className={`rounded-full border border-white/15 bg-white/[0.03] font-medium text-slate-300 transition hover:border-[color:var(--color-primary)] hover:text-white ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {topic.title}
    </button>
  );
}

function Assistant() {
  const [messages, setMessages] = useState(() => [{ role: "assistant", reply: respond("") }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = (text) => {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", reply: respond(q) }]);
    setInput("");
  };
  const pickTopic = (id) => {
    const flow = flowById(id);
    if (!flow) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: TOPICS.find((t) => t.id === id)?.title || "Show me" },
      { role: "assistant", reply: flow },
    ]);
  };
  // Let TopicChip buttons anywhere in the thread trigger a pick.
  pickHandler = pickTopic;

  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/15 text-[var(--color-primary)]">
          <Sparkles size={17} />
        </div>
        <div>
          <div className="text-sm font-bold text-white">Hub Assistant</div>
          <div className="text-[11px] text-slate-500">
            Free guided help, walks you through building anything in the hub.
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[46vh] min-h-[240px] space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[color:var(--color-primary)]/20 px-3 py-2 text-sm text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5">
                <AssistantReply reply={m.reply} />
              </div>
            </div>
          )
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask how to build something… e.g. “add a rank”"
          className="flex-1"
        />
        <Button type="submit" icon={Send} disabled={!input.trim()}>
          Ask
        </Button>
      </form>
    </Panel>
  );
}

// ── Glossary (shared with the Builder's Key Guide) ───────────────────────────

function Glossary() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      GLOSSARY.map((s) => ({
        ...s,
        terms: q ? s.terms.filter((t) => `${t.term} ${t.def}`.toLowerCase().includes(q)) : s.terms,
      })).filter((s) => s.terms.length > 0),
    [q]
  );

  return (
    <div className="grid gap-5">
      <Panel className="p-5">
        <SectionHeader
          title="Glossary"
          subtitle="Every term used around the hub, in plain language. Search or scroll."
        />
        <div className="relative max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            placeholder="Search a term… e.g. hero kicker"
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Panel>

      {sections.map((s) => (
        <Panel key={s.section} className="p-5">
          <SectionHeader title={s.section} />
          <dl className="grid gap-3">
            {s.terms.map((t) => (
              <div key={t.term} className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
                <dt className="text-sm font-bold text-white">{t.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{t.def}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}
      {sections.length === 0 && (
        <Panel className="p-8 text-center text-sm text-slate-500">
          Nothing matches “{query}”. Try a shorter word, or ask the assistant above.
        </Panel>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage({ page }) {
  const [tab, setTab] = useState("assistant");
  return (
    <div>
      <PageHeader
        kicker="Support"
        title={page?.label || "Help"}
        subtitle="Ask the assistant to walk you through building, or browse the glossary of every term."
      />
      <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-1">
        {[
          { id: "assistant", label: "Assistant", icon: Sparkles },
          { id: "glossary", label: "Glossary", icon: BookOpen },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-[color:var(--color-primary)]/20 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === "assistant" ? <Assistant /> : <Glossary />}
    </div>
  );
}
