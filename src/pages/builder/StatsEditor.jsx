import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import {
  Button,
  IconButton,
  Field,
  Input,
  Select,
  ColorInput,
} from "../../components/common/index.jsx";
import * as R from "../../lib/roster.js";

export const STAT_MODES = [
  { value: "total", label: "Total members" },
  { value: "status", label: "Count by status" },
  { value: "cert", label: "Count certified" },
  { value: "manual", label: "Manual value" },
];

/*
 * The Department Statistics editor, shared between the Builder's Roster Setup
 * tab and the gear button on the Roster page itself. When `subId` is given
 * (the Roster page), the subdivision can opt into its OWN stats panel,
 * stored on the subdivision, while the others keep the shared one. Without
 * `subId` (the Builder), it always edits the shared panel.
 */
export default function StatsEditor({ subId = null }) {
  const { config, mutate } = useConfig();
  const fields = config.roster.memberFields || [];
  const sub = subId ? (config.roster.subdivisions || []).find((s) => s.id === subId) : null;
  const shared = config.roster.stats || { show: false, items: [] };
  const hasOverride = Boolean(sub?.stats);
  const stats = hasOverride ? sub.stats : shared;
  const items = stats.items || [];

  // Turn a subdivision-specific panel on (seeded from the shared one) or off.
  const setOverride = (on) =>
    mutate(
      R.updateSubdivision(config, subId, {
        stats: on ? JSON.parse(JSON.stringify({ show: true, ...shared })) : null,
      })
    );

  const statusField =
    fields.find((f) => f.type === "select" && /status/i.test(`${f.label} ${f.id}`)) ||
    fields.find((f) => f.type === "select");
  const certFields = fields.filter((f) => f.type === "cert" || f.type === "checkbox");

  const setStats = (patch) => {
    if (hasOverride) {
      mutate(R.updateSubdivision(config, subId, { stats: { ...sub.stats, ...patch } }));
    } else {
      mutate((cfg) => ({
        ...cfg,
        roster: { ...cfg.roster, stats: { ...(cfg.roster.stats || {}), ...patch } },
      }));
    }
  };
  const setItems = (next) => setStats({ items: next });
  const addItem = () =>
    setItems([...items, { id: R.uid("stat"), label: "Metric", mode: "total" }]);
  const updateItem = (id, patch) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));
  const moveItem = (id, dir) => {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  return (
    <div className="grid gap-4">
      {sub && (
        <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={hasOverride}
            onChange={(e) => setOverride(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
          />
          <span>
            Give <strong className="text-white">{sub.name}</strong> its own statistics panel
            (e.g. “Subdivision Statistics”). Other subdivisions keep the shared panel,
            untick to go back to it.
            {!hasOverride && (
              <span className="block text-xs text-slate-500">
                Currently editing the shared panel used by every subdivision.
              </span>
            )}
          </span>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={!!stats.show}
            onChange={(e) => setStats({ show: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Show the statistics panel on the roster
        </label>
        <Field label="Panel title">
          <Input
            value={stats.title || ""}
            placeholder="Department Statistics"
            onChange={(e) => setStats({ title: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500">No metrics yet, add your first one below.</p>
        )}
        {items.map((it, idx) => (
          <div
            key={it.id}
            className="grid grid-cols-1 items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 sm:grid-cols-[1fr_140px_1fr_110px_auto]"
          >
            <Field label="Label">
              <Input value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} />
            </Field>
            <Field label="Source">
              <Select value={it.mode} onChange={(e) => updateItem(it.id, { mode: e.target.value })}>
                {STAT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            {it.mode === "status" ? (
              <Field label="Status value">
                <Select
                  value={it.statusValue || ""}
                  onChange={(e) => updateItem(it.id, { statusValue: e.target.value })}
                >
                  <option value="">—</option>
                  {(statusField?.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : it.mode === "cert" ? (
              <Field label="Certification column">
                <Select
                  value={it.fieldId || ""}
                  onChange={(e) => updateItem(it.id, { fieldId: e.target.value })}
                >
                  <option value="">—</option>
                  {certFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : it.mode === "manual" ? (
              <Field label="Value">
                <Input
                  value={it.value || ""}
                  onChange={(e) => updateItem(it.id, { value: e.target.value })}
                />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Color">
              <ColorInput value={it.color || ""} onChange={(v) => updateItem(it.id, { color: v })} />
            </Field>
            <div className="mb-0.5 flex items-center gap-1">
              <IconButton
                icon={ChevronUp}
                label="Move up"
                disabled={idx === 0}
                onClick={() => moveItem(it.id, -1)}
                className="disabled:opacity-30"
              />
              <IconButton
                icon={ChevronDown}
                label="Move down"
                disabled={idx === items.length - 1}
                onClick={() => moveItem(it.id, 1)}
                className="disabled:opacity-30"
              />
              <IconButton
                icon={Trash2}
                label="Delete metric"
                onClick={() => removeItem(it.id)}
                className="hover:border-red-500/40 hover:text-red-300"
              />
            </div>
          </div>
        ))}
      </div>

      <Button icon={Plus} className="justify-self-start" onClick={addItem}>
        Add metric
      </Button>
    </div>
  );
}
