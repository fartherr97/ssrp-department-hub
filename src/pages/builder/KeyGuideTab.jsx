import { useState } from "react";
import { Search } from "lucide-react";
import { Panel, SectionHeader, Input } from "../../components/common/index.jsx";
import { GLOSSARY } from "../../lib/helpContent.js";

/*
 * Key Guide, a plain-English glossary of every term used around the hub and
 * the Builder, for Department Heads with no web background. Searchable; each
 * entry says what the thing is and where to find it.
 */


export default function KeyGuideTab() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = GLOSSARY.map((s) => ({
    ...s,
    terms: q
      ? s.terms.filter((t) => `${t.term} ${t.def}`.toLowerCase().includes(q))
      : s.terms,
  })).filter((s) => s.terms.length > 0);

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader
          title="Key Guide"
          subtitle="Every term used around the hub, explained in plain language. Search or scroll."
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
              <div
                key={t.term}
                className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
              >
                <dt className="text-sm font-bold text-white">{t.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{t.def}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}

      {sections.length === 0 && (
        <Panel className="p-8 text-center text-sm text-slate-500">
          Nothing matches “{query}”. Try a shorter word, or ask in the staff Discord and
          we'll add it to the guide.
        </Panel>
      )}
    </div>
  );
}
