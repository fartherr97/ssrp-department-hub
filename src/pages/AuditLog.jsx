import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, History, RotateCcw, ChevronRight, ArrowRight } from "lucide-react";
import * as audit from "../lib/audit.js";
import { useConfig } from "../lib/configContext.jsx";
import { canManageSite, canViewAuditLog, canViewVersionHistory } from "../lib/permissions.js";
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
  exams: { label: "Exams", color: "#14b8a6" },
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
  const [versionsError, setVersionsError] = useState(false);
  const [view, setView] = useState("log"); // "log" | "versions"
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set()); // entry ids opened

  // Two independently-grantable capabilities decide which tabs show. Restoring a
  // version still needs Manage site (a restore can re-grant permissions).
  const canAudit = canViewAuditLog(user, config);
  const canVersions = canViewVersionHistory(user, config);
  const canRestore = canManageSite(user, config);

  const tabs = [
    canAudit && { id: "log", label: "Activity log", icon: ClipboardList },
    canVersions && { id: "versions", label: "Version history", icon: History },
  ].filter(Boolean);
  // Keep the active view valid for what this user may see.
  const activeView = tabs.some((t) => t.id === view) ? view : tabs[0]?.id;

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    const load = () => {
      if (canAudit) audit.getLog().then((l) => setLog(Array.isArray(l) ? l : []));
      if (canVersions) {
        audit
          .getVersions()
          .then((v) => { setVersions(Array.isArray(v) ? v : []); setVersionsError(false); })
          .catch((e) => { setVersions([]); setVersionsError(true); console.warn("[audit] could not load versions:", e?.message || e); });
      }
    };
    load();
    window.addEventListener("audit:changed", load);
    return () => window.removeEventListener("audit:changed", load);
  }, [canAudit, canVersions]);

  async function restore(version) {
    // The list only carries metadata, so pull the full snapshot by id now.
    let cfg = version?.config;
    if (!cfg && version?.id) {
      try {
        cfg = await audit.getVersion(version.id);
      } catch {
        cfg = null;
      }
    }
    if (!cfg) {
      show("Couldn't load that version to restore", "error");
      return;
    }
    replaceConfig(cfg);
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

      {tabs.length > 1 && (
        <div className="mb-4 flex gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeView === t.id;
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
      )}

      {activeView === "versions" ? (
        <VersionHistory
          versions={versions}
          canRestore={canRestore}
          error={versionsError}
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
              const isOpen = expanded.has(e.id);
              const changes = Array.isArray(e.changes) ? e.changes : [];
              return (
                <div key={e.id}>
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                  >
                    <ChevronRight
                      size={15}
                      className={`shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
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
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/5 bg-black/20 px-4 py-3 sm:pl-11">
                      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        <span className="text-slate-500">Changed by</span>
                        <span className="font-semibold text-white">{e.actor?.name || "System"}</span>
                        {e.actor?.discordId && (
                          <span className="font-mono text-slate-400">
                            Discord ID: {e.actor.discordId}
                          </span>
                        )}
                        <span className="text-slate-500">{when.toLocaleString()}</span>
                      </div>
                      {changes.length ? (
                        <div className="grid gap-1">
                          {changes.map((c, i) => (
                            <div
                              key={i}
                              className="flex flex-col gap-1 rounded-lg bg-white/[0.02] px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3"
                            >
                              <span
                                className="shrink-0 font-semibold text-slate-300 sm:w-56 sm:truncate"
                                title={c.label}
                              >
                                {c.label}
                              </span>
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span
                                  className="min-w-0 flex-1 truncate rounded bg-red-500/10 px-2 py-1 text-red-300"
                                  title={c.before}
                                >
                                  {c.before}
                                </span>
                                <ArrowRight size={13} className="shrink-0 text-slate-500" />
                                <span
                                  className="min-w-0 flex-1 truncate rounded bg-emerald-500/10 px-2 py-1 text-emerald-300"
                                  title={c.after}
                                >
                                  {c.after}
                                </span>
                              </div>
                            </div>
                          ))}
                          {changes.length >= 30 && (
                            <div className="px-1 pt-1 text-[11px] text-slate-500">
                              Showing the first 30 changes.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          No field-level detail was recorded for this change.
                        </div>
                      )}
                    </div>
                  )}
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

function VersionHistory({ versions, canRestore, error, onRestore }) {
  if (versions.length === 0) {
    // Distinguish "load failed" from "genuinely empty" so an empty screen isn't
    // mistaken for a broken feature.
    if (error) {
      return (
        <EmptyState
          icon={History}
          title="Couldn't load version history"
          subtitle="The server didn't return the saved versions. Check your connection and try again; if it persists, the backend may need a redeploy."
        />
      );
    }
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
        {!canRestore && " Restoring a version requires the Manage site permission."}
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
