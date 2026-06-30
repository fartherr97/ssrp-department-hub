import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Users, FileText, CalendarDays, Network, X } from "lucide-react";
import { callsignFieldId, statusFieldId } from "../../lib/roster.js";
import { getPagePath, buildSubPath } from "../../lib/navigation.js";

/*
 * Site-wide search. One box to find a person across the whole hub: their
 * subdivision, rank, callsign, and status from the roster AND their position in
 * the chain of command, shown together. Also jumps to pages and calendar events.
 * Open with the toolbar button or Ctrl/Cmd+K.
 */

function walkTree(node, fn) {
  if (!node) return;
  fn(node);
  (node.children || []).forEach((c) => walkTree(c, fn));
}

function buildIndex(config) {
  const pages = config?.pages || [];
  const rosterPage = pages.find((p) => p.type === "roster");
  const csId = callsignFieldId(config);
  const stId = statusFieldId(config);

  // Chain-of-command positions, keyed by holder name (lowercased).
  const cocByName = new Map();
  for (const p of pages.filter((x) => x.type === "chain")) {
    walkTree(p.config?.root, (node) => {
      const holders = [node.name, ...(node.members || [])].filter(Boolean);
      for (const h of holders) {
        const key = h.trim().toLowerCase();
        if (!key) continue;
        const list = cocByName.get(key) || [];
        list.push({ title: node.title, pageId: p.id, pageLabel: p.label });
        cocByName.set(key, list);
      }
    });
  }

  // People from the roster, enriched with their CoC positions.
  const people = [];
  const seenNames = new Set();
  for (const sub of config?.roster?.subdivisions || []) {
    const rankById = Object.fromEntries((sub.ranks || []).map((r) => [r.id, r.name]));
    for (const cat of sub.categories || []) {
      for (const m of cat.members || []) {
        const nameKey = (m.name || "").trim().toLowerCase();
        seenNames.add(nameKey);
        people.push({
          kind: "person",
          id: m.id,
          name: m.name || "Unnamed",
          discordId: m.discordId || "",
          subName: sub.name,
          subId: sub.id,
          catName: cat.name,
          rank: rankById[m.rank] || "",
          callsign: csId ? m.fields?.[csId] || "" : "",
          status: stId ? m.fields?.[stId] || "" : "",
          coc: cocByName.get(nameKey) || [],
          pageId: rosterPage?.id,
        });
      }
    }
  }

  // People who only appear in the chain of command (not on the roster).
  for (const [key, posList] of cocByName) {
    if (seenNames.has(key)) continue;
    people.push({
      kind: "person",
      id: `coc-${key}`,
      name: posList[0] ? key.replace(/\b\w/g, (c) => c.toUpperCase()) : key,
      discordId: "",
      coc: posList,
      pageId: posList[0]?.pageId,
    });
  }

  // Calendar events.
  const events = [];
  for (const p of pages.filter((x) => x.type === "calendar")) {
    for (const ev of p.config?.events || []) {
      events.push({
        kind: "event",
        id: ev.id,
        name: ev.title || "Event",
        date: ev.date || "",
        location: ev.location || "",
        pageId: p.id,
      });
    }
  }

  const pageItems = pages
    .filter((p) => p.type !== "builder")
    .map((p) => ({ kind: "page", id: p.id, name: p.label, pageType: p.type, pageId: p.id }));

  return { people, events, pages: pageItems };
}

function scoreMatch(haystack, q) {
  const h = haystack.toLowerCase();
  const i = h.indexOf(q);
  if (i < 0) return -1;
  return i === 0 ? 2 : 1; // prefix matches rank higher
}

export default function GlobalSearch({ config, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  const index = useMemo(() => (open ? buildIndex(config) : null), [open, config]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!index || q.trim().length < 1) return null;
    const term = q.trim().toLowerCase();
    const rank = (item, fields) => {
      let best = -1;
      for (const f of fields) {
        if (!f) continue;
        best = Math.max(best, scoreMatch(String(f), term));
      }
      return best;
    };
    const people = index.people
      .map((p) => ({ p, s: rank(p, [p.name, p.discordId, p.callsign, p.rank, p.subName, ...p.coc.map((c) => c.title)]) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.p);
    const pages = index.pages
      .map((p) => ({ p, s: scoreMatch(p.name, term) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.p);
    const events = index.events
      .map((p) => ({ p, s: rank(p, [p.name, p.location]) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.p);
    return { people, pages, events };
  }, [index, q]);

  function jump(item) {
    setOpen(false);
    if (!item.pageId) return;
    // Land on the right subdivision for roster people when possible.
    if (item.kind === "person" && item.subId) {
      window.history.pushState(null, "", buildSubPath(item.pageId, item.subId));
    } else {
      window.history.pushState(null, "", getPagePath(item.pageId, config));
    }
    onNavigate(item.pageId);
  }

  const total = results
    ? results.people.length + results.pages.length + results.events.length
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the site"
        title="Search (Ctrl/⌘ K)"
        className="press inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-slate-400 transition hover:text-white sm:px-3"
      >
        <Search size={16} />
        <span className="hidden text-xs font-medium sm:inline">Search</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto p-4 pt-[10vh]">
            <div
              className="anim-overlay-in fixed inset-0 bg-black/70"
              onClick={() => setOpen(false)}
            />
            <div className="anim-modal-in hub-panel relative z-10 w-full max-w-xl overflow-hidden rounded-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4">
                <Search size={18} className="shrink-0 text-slate-500" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search people, pages, events…"
                  className="w-full bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="press rounded-lg p-1.5 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2">
                {!results ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">
                    Type a name to see someone’s subdivision, rank, callsign, and chain-of-command
                    position at once.
                  </p>
                ) : total === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">No matches.</p>
                ) : (
                  <div className="grid gap-3">
                    {results.people.length > 0 && (
                      <Group icon={Users} label="People">
                        {results.people.map((p) => (
                          <button key={p.id} onClick={() => jump(p)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                              <div className="truncate text-xs text-slate-400">
                                {[p.subName, p.rank, p.callsign && `#${p.callsign}`, p.status]
                                  .filter(Boolean)
                                  .join(" · ") || "Not on the roster"}
                              </div>
                              {p.coc.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <Network size={11} className="text-[var(--color-primary)]" />
                                  <span className="truncate text-[11px] text-slate-400">
                                    {p.coc.map((c) => c.title).join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </Group>
                    )}
                    {results.pages.length > 0 && (
                      <Group icon={FileText} label="Pages">
                        {results.pages.map((p) => (
                          <button key={p.id} onClick={() => jump(p)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]">
                            <span className="truncate text-sm text-slate-200">{p.name}</span>
                          </button>
                        ))}
                      </Group>
                    )}
                    {results.events.length > 0 && (
                      <Group icon={CalendarDays} label="Events">
                        {results.events.map((p) => (
                          <button key={p.id} onClick={() => jump(p)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]">
                            <div className="min-w-0">
                              <div className="truncate text-sm text-slate-200">{p.name}</div>
                              <div className="truncate text-xs text-slate-500">
                                {[p.date, p.location].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </button>
                        ))}
                      </Group>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Group({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.5px] text-slate-500">
        <Icon size={11} />
        {label}
      </div>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}
