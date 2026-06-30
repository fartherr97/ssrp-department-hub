import { useEffect, useMemo, useState } from "react";
import { Users, CalendarDays, FileText, Activity } from "lucide-react";
import * as audit from "../lib/audit.js";
import { Panel, PageHeader, EmptyState } from "../components/common/index.jsx";

/*
 * Member-facing department activity feed. A friendly, read-only changelog of
 * what's changed (roster moves, calendar events, new pages), built from the same
 * audit log staff see, so people don't have to re-check pages for updates.
 * Sensitive categories (access, branding, raw config) are left out.
 */

// Which audit categories surface to members, with an icon + accent.
const FEED_META = {
  roster: { label: "Roster", color: "#3d82f0", icon: Users },
  calendar: { label: "Calendar", color: "#1eb854", icon: CalendarDays },
  pages: { label: "Pages", color: "#d98a1e", icon: FileText },
};

function relTime(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  return `${Math.floor(s / 86400)}d ago`;
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function ActivityFeed({ page }) {
  const [log, setLog] = useState([]);
  const cats = page?.config?.categories || ["roster", "calendar", "pages"];

  useEffect(() => {
    const load = () => audit.getLog().then((l) => setLog(Array.isArray(l) ? l : []));
    load();
    window.addEventListener("audit:changed", load);
    return () => window.removeEventListener("audit:changed", load);
  }, []);

  const groups = useMemo(() => {
    const items = log.filter((e) => cats.includes(e.category) && FEED_META[e.category]);
    const out = [];
    let cur = null;
    for (const e of items) {
      const label = dayLabel(e.ts);
      if (!cur || cur.label !== label) {
        cur = { label, items: [] };
        out.push(cur);
      }
      cur.items.push(e);
    }
    return out;
  }, [log, cats]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={Activity}
        title={page?.label || "Department Activity"}
        subtitle="Recent changes across the department, so you don't have to keep checking."
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          subtitle="Roster moves, calendar events, and page updates will show up here as they happen."
        />
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
                {g.label}
              </div>
              <Panel className="overflow-hidden">
                {g.items.map((e, i) => {
                  const meta = FEED_META[e.category];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={e.id || i}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        i > 0 ? "border-t border-white/5" : ""
                      }`}
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 22%, transparent)` }}
                      >
                        <Icon size={14} style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-100">{e.action}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {e.actor?.name || "Someone"} · {relTime(e.ts)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Panel>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
