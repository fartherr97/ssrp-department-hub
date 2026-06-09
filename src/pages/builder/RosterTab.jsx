import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Select,
  ColorInput,
} from "../../components/common/index.jsx";
import * as R from "../../lib/roster.js";
import TabIntro from "./TabIntro.jsx";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "cert", label: "Certification" },
];

const STAT_MODES = [
  { value: "total", label: "Total members" },
  { value: "status", label: "Count by status" },
  { value: "cert", label: "Count certified" },
  { value: "manual", label: "Manual value" },
];

// ─── Per-subdivision appearance (accent + banner) ────────────────────────────

function SubdivisionAppearance({ sub }) {
  const { config, mutate } = useConfig();
  const banner = sub.banner || {};
  const setBanner = (patch) =>
    mutate(R.updateSubdivision(config, sub.id, { banner: { ...banner, ...patch } }));

  return (
    <details className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-[0.4px] text-cad-muted">
        Appearance — accent & banner
      </summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Accent color">
            <ColorInput
              value={sub.accent || ""}
              onChange={(v) => mutate(R.updateSubdivision(config, sub.id, { accent: v }))}
            />
          </Field>
          <Field
            label="Banner image URL"
            hint="Wide background, ~1600×400px. Blank for an accent gradient."
          >
            <Input
              value={banner.imageUrl || ""}
              placeholder="https://…"
              onChange={(e) => setBanner({ imageUrl: e.target.value })}
            />
          </Field>
          <Field label="Banner title">
            <Input
              value={banner.title || ""}
              placeholder={sub.name}
              onChange={(e) => setBanner({ title: e.target.value })}
            />
          </Field>
          <Field label="Banner subtitle">
            <Input
              value={banner.subtitle || ""}
              onChange={(e) => setBanner({ subtitle: e.target.value })}
            />
          </Field>
          <Field label="Left logo URL" hint="Square, ~128×128px (PNG/SVG).">
            <Input
              value={banner.logoUrl || ""}
              placeholder="https://…"
              onChange={(e) => setBanner({ logoUrl: e.target.value })}
            />
          </Field>
          <Field label="Right logo URL" hint="Square, ~128×128px (PNG/SVG).">
            <Input
              value={banner.logoUrl2 || ""}
              placeholder="https://…"
              onChange={(e) => setBanner({ logoUrl2: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </details>
  );
}

// ─── Member column editor (incl. dropdown colors / pills) ────────────────────

function ColumnEditor({ field }) {
  const { config, mutate } = useConfig();
  const update = (patch) => mutate(R.updateMemberField(config, field.id, patch));
  const options = field.options || [];
  const optionColors = field.optionColors || {};

  return (
    <div className="grid grid-cols-1 items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 sm:grid-cols-[1fr_150px_auto]">
      <Field label="Label">
        <Input value={field.label} onChange={(e) => update({ label: e.target.value })} />
      </Field>
      <Field label="Type">
        <Select value={field.type} onChange={(e) => update({ type: e.target.value })}>
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <IconButton
        icon={Trash2}
        label="Delete column"
        onClick={() => mutate(R.deleteMemberField(config, field.id))}
        className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
      />

      {field.type === "select" && (
        <div className="grid gap-3 sm:col-span-3">
          <Field label="Options (comma separated)">
            <Input
              value={options.join(", ")}
              onChange={(e) =>
                update({
                  options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={!!field.pill}
              onChange={(e) => update({ pill: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Show values as colored status pills
          </label>
          {field.pill && options.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-2">
              {options.map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-xs font-semibold text-slate-400">
                    {opt}
                  </span>
                  <ColorInput
                    value={optionColors[opt] || ""}
                    onChange={(v) => update({ optionColors: { ...optionColors, [opt]: v } })}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Department stats editor ─────────────────────────────────────────────────

function StatsEditor() {
  const { config, mutate } = useConfig();
  const fields = config.roster.memberFields || [];
  const stats = config.roster.stats || { show: false, items: [] };
  const items = stats.items || [];

  const statusField =
    fields.find((f) => f.type === "select" && /status/i.test(`${f.label} ${f.id}`)) ||
    fields.find((f) => f.type === "select");
  const certFields = fields.filter((f) => f.type === "cert" || f.type === "checkbox");

  const setStats = (patch) =>
    mutate((cfg) => ({
      ...cfg,
      roster: { ...cfg.roster, stats: { ...(cfg.roster.stats || {}), ...patch } },
    }));
  const setItems = (next) => setStats({ items: next });
  const addItem = () =>
    setItems([...items, { id: R.uid("stat"), label: "Metric", mode: "total" }]);
  const updateItem = (id, patch) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Department stats"
        subtitle="A metrics box above the roster, computed over the active subdivision."
        actions={
          <Button icon={Plus} onClick={addItem}>
            Add metric
          </Button>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={!!stats.show}
          onChange={(e) => setStats({ show: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        Show the stats box on the roster
      </label>
      <div className="grid gap-2">
        {items.length === 0 && <p className="text-sm text-slate-500">No metrics yet.</p>}
        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-1 items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3 sm:grid-cols-[1fr_150px_1fr_auto_auto]"
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
              <ColorInput
                value={it.color || ""}
                onChange={(v) => updateItem(it.id, { color: v })}
              />
            </Field>
            <IconButton
              icon={Trash2}
              label="Delete metric"
              onClick={() => removeItem(it.id)}
              className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Roster schema tab ───────────────────────────────────────────────────────

const LAYOUTS = [
  { value: "tabs", label: "Tabs", hint: "One subdivision at a time" },
  { value: "grid", label: "Side-by-side", hint: "All subdivisions in a grid" },
];

export default function RosterTab() {
  const { config, mutate } = useConfig();
  const fields = config.roster.memberFields || [];
  const subdivisions = config.roster.subdivisions || [];
  const layout = config.roster.layout === "grid" ? "grid" : "tabs";
  const setLayout = (value) =>
    mutate((cfg) => ({ ...cfg, roster: { ...cfg.roster, layout: value } }));

  return (
    <div className="grid gap-6">
      <TabIntro>
        This tab shapes the <strong className="text-white">structure</strong> of your roster:
        the subdivisions (e.g. Patrol, K9), the columns every member has, and the stats box.
        The people themselves are added on the{" "}
        <strong className="text-white">Roster page</strong> — go there to add ranks, members,
        and move people around.
      </TabIntro>

      <Panel className="p-5">
        <SectionHeader
          title="Roster layout"
          subtitle="How members see the subdivisions on the Roster page."
        />
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((l) => {
            const active = layout === l.value;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setLayout(l.value)}
                className={`press flex-1 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/12 text-white"
                    : "border-white/10 bg-[var(--color-surface-2)] text-slate-300 hover:text-white"
                }`}
              >
                <div className="text-sm font-bold">{l.label}</div>
                <div className="text-xs text-slate-500">{l.hint}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Subdivisions"
          subtitle="Each subdivision is a separate roster with its own accent and banner. Categories (the colored bands), ranks, and members are managed on the Roster page."
          actions={
            <Button
              icon={Plus}
              onClick={() => mutate(R.addSubdivision(config, { name: "New Subdivision" }))}
            >
              Add subdivision
            </Button>
          }
        />
        <div className="grid gap-3">
          {subdivisions.map((s, idx) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
            >
              <div className="flex items-center gap-3">
                <Input
                  value={s.name}
                  onChange={(e) =>
                    mutate(R.updateSubdivision(config, s.id, { name: e.target.value }))
                  }
                  className="flex-1"
                />
                <span className="shrink-0 text-xs text-slate-500">
                  {(s.categories || []).length} categor{(s.categories || []).length === 1 ? "y" : "ies"} ·{" "}
                  {(s.ranks || []).length} rank(s) ·{" "}
                  {(s.categories || []).reduce((n, c) => n + c.members.length, 0)} member(s)
                </span>
                <IconButton
                  icon={ChevronUp}
                  label="Move up"
                  disabled={idx === 0}
                  onClick={() => mutate(R.moveSubdivision(config, s.id, -1))}
                  className="disabled:opacity-30"
                />
                <IconButton
                  icon={ChevronDown}
                  label="Move down"
                  disabled={idx === subdivisions.length - 1}
                  onClick={() => mutate(R.moveSubdivision(config, s.id, 1))}
                  className="disabled:opacity-30"
                />
                <IconButton
                  icon={Trash2}
                  label="Delete subdivision"
                  disabled={subdivisions.length <= 1}
                  onClick={() => mutate(R.deleteSubdivision(config, s.id))}
                  className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
                />
              </div>
              <SubdivisionAppearance sub={s} />
            </div>
          ))}
          {subdivisions.length === 0 && (
            <p className="text-sm text-slate-500">No subdivisions yet.</p>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Member columns"
          subtitle="Custom fields captured for every member, shared across all subdivisions. Dropdowns can render as colored status pills."
          actions={
            <Button
              icon={Plus}
              onClick={() => mutate(R.addMemberField(config, { label: "New Field", type: "text" }))}
            >
              Add column
            </Button>
          }
        />
        <div className="grid gap-3">
          {fields.map((f) => (
            <ColumnEditor key={f.id} field={f} />
          ))}
          {fields.length === 0 && <p className="text-sm text-slate-500">No custom columns yet.</p>}
        </div>
      </Panel>

      <StatsEditor />
    </div>
  );
}
