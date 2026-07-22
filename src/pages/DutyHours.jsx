import { useEffect, useMemo, useState } from "react";
import { Clock, Trophy, RefreshCw, AlertTriangle } from "lucide-react";
import * as api from "../lib/api.js";
import { useConfig } from "../lib/configContext.jsx";
import { callsignFieldId } from "../lib/roster.js";
import { Panel, PageHeader, EmptyState } from "../components/common/index.jsx";

/*
 * Duty hours dashboard. On-duty time comes from the external Duty Hub (the
 * backend serves GET /api/hours). We join those hours to roster members for rank
 * + callsign, and count strikes from the admin logs,
 * so command can see name / rank / callsign / hours / strikes in one place — and
 * a weekly leaderboard for the hours prize.
 */

const MEDAL = ["#f5c542", "#c7ced8", "#cd7f32"]; // gold / silver / bronze

function strikeCounts(config) {
  const counts = new Map();
  for (const p of config?.pages || []) {
    if (p.type !== "adminlog") continue;
    for (const e of p.config?.entries || []) {
      if (!/strike/i.test(e.type || "")) continue;
      const id = e.subject?.discordId;
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

export default function DutyHours({ page }) {
  const { config } = useConfig();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const topN = page?.config?.topN || 10;

  const load = () => {
    setLoading(true);
    api.getDutyHours().then((f) => {
      setFeed(f || { members: [] });
      setLoading(false);
    });
  };
  useEffect(load, []);

  const rows = useMemo(() => {
    if (!feed) return [];
    const csId = callsignFieldId(config);
    const strikes = strikeCounts(config);
    const byDiscord = new Map();
    const byMemberId = new Map();
    for (const h of feed.members || []) {
      if (h.discordId) byDiscord.set(String(h.discordId), h);
      if (h.memberId) byMemberId.set(h.memberId, h);
    }
    const out = [];
    for (const sub of config?.roster?.subdivisions || []) {
      const rankById = Object.fromEntries((sub.ranks || []).map((r) => [r.id, r.name]));
      for (const cat of sub.categories || []) {
        for (const m of cat.members || []) {
          const h = byDiscord.get(String(m.discordId)) || byMemberId.get(m.id) || {};
          out.push({
            id: m.id,
            name: m.name,
            discordId: m.discordId || "",
            rank: rankById[m.rank] || "",
            callsign: csId ? m.fields?.[csId] || "" : "",
            sub: sub.name,
            weekHours: Number(h.weekHours) || 0,
            monthHours: Number(h.monthHours) || 0,
            strikes: strikes.get(String(m.discordId)) || 0,
          });
        }
      }
    }
    return out;
  }, [feed, config]);

  const leaderboard = useMemo(
    () => [...rows].filter((r) => r.weekHours > 0).sort((a, b) => b.weekHours - a.weekHours).slice(0, topN),
    [rows, topN]
  );
  const table = useMemo(() => [...rows].sort((a, b) => b.monthHours - a.monthHours), [rows]);
  const maxWeek = leaderboard[0]?.weekHours || 1;

  const updated = feed?.updatedAt ? new Date(feed.updatedAt).toLocaleString() : null;

  return (
    <div>
      <PageHeader
        icon={Clock}
        title={page?.label || "Duty Hours"}
        subtitle="On-duty time from the Duty Hub, with the week's leaderboard for the hours prize."
        actions={
          <button
            onClick={load}
            className="press inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:text-white"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title={loading ? "Loading hours…" : "No hours yet"}
          subtitle="Once the Duty Hub feed is connected (or members are on the roster), hours show up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {/* Weekly leaderboard */}
          <div>
            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
              <Trophy size={12} className="text-[#f5c542]" />
              Top hours this week
            </div>
            <Panel className="overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  No hours logged this week yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {leaderboard.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                        style={{
                          backgroundColor: MEDAL[i]
                            ? `color-mix(in srgb, ${MEDAL[i]} 28%, transparent)`
                            : "rgba(255,255,255,0.05)",
                          color: MEDAL[i] || "#94a3b8",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">
                          {r.name}
                          {r.callsign && (
                            <span className="ml-2 font-mono text-[11px] text-slate-500">{r.callsign}</span>
                          )}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(6, (r.weekHours / maxWeek) * 100)}%`,
                              background: "linear-gradient(90deg, var(--color-primary), var(--color-hover))",
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-black tabular-nums text-white">{r.weekHours}</span>
                        <span className="ml-0.5 text-[11px] text-slate-500">h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Full hours table */}
          <div>
            <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
              All members
            </div>
            <Panel className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">Name</th>
                    <th className="px-3 py-2.5 font-semibold">Rank</th>
                    <th className="px-3 py-2.5 font-semibold">Callsign</th>
                    <th className="px-3 py-2.5 text-right font-semibold">This week</th>
                    <th className="px-3 py-2.5 text-right font-semibold">This month</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Strikes</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="px-3 py-2.5 text-sm font-semibold text-white">{r.name}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-300">{r.rank || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-slate-300">{r.callsign || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-200">{r.weekHours}h</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-white">{r.monthHours}h</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.strikes > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
                            <AlertTriangle size={11} />
                            {r.strikes}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <p className="px-1 text-[11px] text-slate-600">
            {updated
              ? `Hours synced from the Duty Hub · updated ${updated}`
              : "Hours from the Duty Hub."}
          </p>
        </div>
      )}
    </div>
  );
}
