import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, History, RotateCcw } from "lucide-react";
import * as audit from "../lib/audit.js";
import { useConfig } from "../lib/configContext.jsx";
import { canManageSite } from "../lib/permissions.js";
import useToast from "../hooks/useToast.js";
import {
  Panel,
  PageHeader,
  Badge,
  Button,
  Input,
  Select,
  EmptyState,
  ConfirmDialog,
  Toast,
} from "../components/common/index.jsx";

// Category → label + accent color for the badge.
const CATEGORY_META = {
  roster: { label: "Roster", color: "#3d82f0" },
  calendar: { label: "Calendar", color: "#1eb854" },
  branding: { label: "Branding", color: "#8b5cf6" },
  pages: { label: "Pages", color: "#d98a1e" },
  access: { label: "Access", color: "#e0556e" },
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
  const { config, replaceConfig } = useConfig();
  const { toast, show } = useToast();
  const [log, setLog] = useState([]);
  const [versions, setVersions] = useState([]);
  const [view, setView] = useState("log"); // "log" | "versions"
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [confirmRestore, setConfirmRestore] = useState(null);

  const canRestore = canManageSite(user, config);

  useEffect(() => {
    const load = () => {
      audit.getLog().then((l) => setLog(Array.isArray(l) ? l : []));
      // Version history is a manage-site feature (the backend only returns the
      // full-config snapshots to site managers), so only fetch it when the user
      // can restore — otherwise the request 403s and the tab stays empty anyway.
      if (canRestore) {
        audit
          .getVersions()
          .then((v) => setVersions(Array.isArray(v) ? v : []))
          .catch(() => setVersions([]));
      }
    };
    load();
    window.addEventListener("audit:changed", load);
    return () => window.removeEventListener("audit:changed", load);
  }, [canRestore]);

  function restore(version) {
    if (!version?.config) return;
    replaceConfig(version.config);
    show("Restored that version");
    setConfirmRestore(null);
  }

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
        subtitle="Who changed what, and when, roster and configuration activity. Restore any past version like a spreadsheet's history."
      />

      <div className="mb-4 flex gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {[
          { id: "log", label: "Activity log", icon: ClipboardList },
          { id: "versions", label: "Version history", icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active ? "bg-[color:var(--color-primary)]/18 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon size={13} className={active ? "text-[var(--color-primary)]" : ""} />
              {t.label}
            </button>
          );
        })}
      </div>

      {view === "versions" ? (
        <VersionHistory
          versions={versions}
          canRestore={canRestore}
          onRestore={(v) => setConfirmRestore(v)}
        />
      ) : (
      <>
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
      </>
      )}

      <ConfirmDialog
        open={Boolean(confirmRestore)}
        title="Restore this version?"
        message={`Roll the whole department back to the state from ${
          confirmRestore ? new Date(confirmRestore.ts).toLocaleString() : ""
        }. Your current state is saved as a new version first, so you can undo this.`}
        confirmLabel="Restore"
        onCancel={() => setConfirmRestore(null)}
        onConfirm={() => restore(confirmRestore)}
      />
      <Toast message={toast} />
    </div>
  );
}

function VersionHistory({ versions, canRestore, onRestore }) {
  if (versions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No saved versions yet"
        subtitle="Each change snapshots the department. Make an edit and it'll appear here, ready to restore."
      />
    );
  }
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2.5 text-[11px] text-slate-500">
        {versions.length} saved {versions.length === 1 ? "version" : "versions"}, newest first. The
        top one is the current state.
      </div>
      <div className="divide-y divide-white/5">
        {versions.map((v, i) => {
          const meta = CATEGORY_META[v.category] || CATEGORY_META.config;
          const when = new Date(v.ts);
          return (
            <div key={v.id || i} className="flex items-center gap-4 px-4 py-3">
              <Badge color={meta.color} className="shrink-0">
                {meta.label}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {v.action}
                  {i === 0 && (
                    <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-400">{v.actor?.name || "System"}</span> ·{" "}
                  {when.toLocaleString()}
                </div>
              </div>
              {canRestore && i !== 0 && (
                <Button
                  variant="secondary"
                  icon={RotateCcw}
                  className="!py-1.5 text-xs"
                  onClick={() => onRestore(v)}
                >
                  Restore
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
