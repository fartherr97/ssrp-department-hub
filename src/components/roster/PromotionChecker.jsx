import { useEffect, useMemo, useState } from "react";
import { Award, Search, SlidersHorizontal, Check } from "lucide-react";
import { Modal, Button, Input, Select, Badge, Field } from "../common/index.jsx";
import { callsignFieldId } from "../../lib/roster.js";
import { promoSettings, collectDAs, evaluateMember, DEFAULT_PROMO } from "../../lib/promotion.js";
import * as api from "../../lib/api.js";

// Initials from the name segment of a "callsign | rank | Surname" roster name.
const initials = (name) => {
  const seg = String(name || "").split("|").pop().trim() || String(name || "");
  const w = seg.split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : seg.slice(0, 2) || "?").toUpperCase();
};

/*
 * Promotion Eligibility Checker. Shows the whole roster for a subdivision and
 * greys out members who aren't eligible for their next rank, with the reason(s)
 * why (on probation, active DA, not enough time in grade, on LOA, top rank).
 * Criteria are configurable and persisted to config.roster.promoEligibility.
 */
export default function PromotionChecker({ open, onClose, config, mutate, subdivisions, initialSubId, canEditStructure }) {
  const [subId, setSubId] = useState(initialSubId || subdivisions[0]?.id);
  const [q, setQ] = useState("");
  const [showCriteria, setShowCriteria] = useState(false);

  const sub = subdivisions.find((s) => s.id === subId) || subdivisions[0];
  const settings = promoSettings(config);
  const das = useMemo(() => collectDAs(config), [config]);
  const csId = callsignFieldId(config);
  const rankName = (id) => (sub?.ranks || []).find((r) => r.id === id)?.name || "";
  const needsHours = settings.minWeekHours > 0 || settings.minMonthHours > 0;

  // On-duty hours feed (only fetched when an activity requirement is set).
  const [hours, setHours] = useState(null);
  useEffect(() => {
    if (!needsHours) { setHours(null); return; }
    let alive = true;
    api.getDutyHours().then((feed) => {
      if (!alive) return;
      setHours(new Map((feed?.members || []).map((h) => [String(h.discordId), { weekHours: Number(h.weekHours) || 0, monthHours: Number(h.monthHours) || 0 }])));
    }).catch(() => alive && setHours(new Map()));
    return () => { alive = false; };
  }, [needsHours]);

  const groups = useMemo(() => {
    const now = Date.now();
    return (sub?.categories || []).map((cat) => ({
      cat,
      rows: (cat.members || []).map((m) => ({ m, ...evaluateMember(config, sub, m, das, hours, settings, now) })),
    }));
  }, [config, sub, das, hours, settings]);

  const allRows = groups.flatMap((g) => g.rows);
  const eligibleCount = allRows.filter((r) => r.eligible).length;
  const term = q.trim().toLowerCase();
  const setSetting = (patch) =>
    mutate((c) => ({ ...c, roster: { ...c.roster, promoEligibility: { ...promoSettings(c), ...patch } } }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Promotion eligibility — ${sub?.name || ""}`}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {subdivisions.length > 1 && (
            <Select value={subId} onChange={(e) => setSubId(e.target.value)} className="w-auto">
              {subdivisions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <div className="relative min-w-40 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a member…" className="pl-9" />
          </div>
          <Badge color="#1eb854">{eligibleCount} eligible</Badge>
          <Badge>{allRows.length} total</Badge>
          <Button variant="secondary" icon={SlidersHorizontal} className="!py-1.5 text-xs" onClick={() => setShowCriteria((v) => !v)}>
            Criteria
          </Button>
        </div>

        {needsHours && !hours && (
          <p className="text-xs text-amber-300/80">Loading on-duty hours… activity isn't applied until it loads.</p>
        )}

        {/* Criteria */}
        {showCriteria && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            {canEditStructure ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Min. days in grade" hint="0 to skip.">
                  <Input type="number" min={0} value={settings.minDaysInGrade}
                    onChange={(e) => setSetting({ minDaysInGrade: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
                <Field label="Active-DA window (days)" hint="A DA/strike this recent counts. 0 = ever.">
                  <Input type="number" min={0} value={settings.daWindowDays}
                    onChange={(e) => setSetting({ daWindowDays: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
                <Field label="Min. hours this week" hint="On-duty hours from the Duty Hub. 0 = skip.">
                  <Input type="number" min={0} step="0.5" value={settings.minWeekHours}
                    onChange={(e) => setSetting({ minWeekHours: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
                <Field label="Min. hours this month" hint="On-duty hours from the Duty Hub. 0 = skip.">
                  <Input type="number" min={0} step="0.5" value={settings.minMonthHours}
                    onChange={(e) => setSetting({ minMonthHours: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  {[
                    ["requireOffProbation", "Must be off probation"],
                    ["excludeLoa", "Exclude members on LOA"],
                    ["excludeTopRank", "Exclude members at the highest rank"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSetting({ [key]: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                      {label}
                    </label>
                  ))}
                </div>
                <button onClick={() => setSetting({ ...DEFAULT_PROMO })} className="w-fit text-xs font-semibold text-[var(--color-primary)] hover:underline sm:col-span-2">
                  Reset to defaults
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Eligible = {settings.requireOffProbation ? "off probation, " : ""}no DA/strike in the last {settings.daWindowDays || "∞"} days
                {settings.minDaysInGrade ? `, ≥ ${settings.minDaysInGrade} days in grade` : ""}
                {settings.minWeekHours ? `, ≥ ${settings.minWeekHours}h this week` : ""}
                {settings.minMonthHours ? `, ≥ ${settings.minMonthHours}h this month` : ""}
                {settings.excludeLoa ? ", not on LOA" : ""}{settings.excludeTopRank ? ", not at the top rank" : ""}. Only structure editors can change these.
              </p>
            )}
          </div>
        )}

        {/* Roster */}
        {allRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No members in this subdivision.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {groups.map(({ cat, rows }) => {
              const visible = rows.filter((r) => !term || `${r.m.name} ${r.m.discordId || ""}`.toLowerCase().includes(term));
              if (!visible.length) return null;
              return (
                <div key={cat.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color || "var(--color-primary)" }} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">{cat.name}</span>
                    <span className="text-[11px] text-slate-600">{visible.filter((r) => r.eligible).length}/{visible.length} eligible</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {visible.map((r) => (
                      <div key={r.m.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${r.eligible ? "border-white/10 bg-white/[0.02]" : "border-white/5 opacity-55"}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-slate-300">{initials(r.m.name)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{r.m.name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {rankName(r.m.rank) || "—"}{csId && r.m.fields?.[csId] ? ` · ${r.m.fields[csId]}` : ""}
                          </div>
                        </div>
                        {r.eligible ? (
                          <Badge color="#1eb854">
                            <Check size={11} className="mr-0.5 inline" />
                            Eligible{r.nextRankName ? ` → ${r.nextRankName}` : ""}
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1">
                            {r.reasons.map((reason) => (
                              <span key={reason.key} title={reason.detail || ""}
                                className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                                {reason.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

export { Award };
