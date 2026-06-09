import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Trash2 } from "lucide-react";
import * as audit from "../lib/audit.js";
import { useConfig } from "../lib/configContext.jsx";
import { isAdmin } from "../lib/permissions.js";
import {
  Panel,
  PageHeader,
  Badge,
  Input,
  Select,
  Button,
  EmptyState,
  ConfirmDialog,
} from "../components/common/index.jsx";

// Category → label + accent color for the badge.
const CATEGORY_META = {
  roster: { label: "Roster", color: "#3d82f0" },
  branding: { label: "Branding", color: "#8b5cf6" },
  pages: { label: "Pages", color: "#d98a1e" },
  access: { label: "Access", color: "#1eb854" },
  config: { label: "Config", color: "#93a4bd" },
};

function relTime(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AuditLog({ user }) {
  const { config } = useConfig();
  const admin = isAdmin(user, config);
  const [log, setLog] = useState([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const load = () => audit.getLog().then((l) => setLog(Array.isArray(l) ? l : []));
    load();
    window.addEventListener("audit:changed", load);
    return () => window.removeEventListener("audit:changed", load);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return log.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (!q) return true;
      return [e.action, e.actor?.name, e.actor?.discordId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [log, query, cat]);

  return (
    <div>
      <PageHeader
        kicker="Administration"
        title="Audit Log"
        subtitle="Who changed what, and when — roster and configuration activity."
        actions={
          admin && log.length > 0 ? (
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmClear(true)}>
              Clear log
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[var(--color-text-muted)]">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, name, ID…"
              className="w-56 pl-9"
            />
          </div>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-40">
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No activity yet"
          subtitle="Roster edits and configuration changes will appear here, with the Discord user who made them."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="divide-y divide-white/5">
            {filtered.map((e) => {
              const meta = CATEGORY_META[e.category] || CATEGORY_META.config;
              const when = new Date(e.ts);
              return (
                <div key={e.id} className="flex items-center gap-4 px-4 py-3">
                  <Badge color={meta.color} className="shrink-0">
                    {meta.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{e.action}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-400">{e.actor?.name || "System"}</span>
                      {e.actor?.discordId && <span className="font-mono">{e.actor.discordId}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-300" title={when.toLocaleString()}>
                      {relTime(e.ts)}
                    </div>
                    <div className="hidden text-[11px] text-slate-600 sm:block">
                      {when.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear audit log?"
        message="Permanently delete all audit entries? This can't be undone."
        confirmLabel="Clear log"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await audit.clearLog();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}
