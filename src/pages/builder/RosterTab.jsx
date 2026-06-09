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
  MediaInput,
  CommaListInput,
} from "../../components/common/index.jsx";
import * as R from "../../lib/roster.js";
import TabIntro from "./TabIntro.jsx";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "cert", label: "Certification" },
  { value: "tenure", label: "Time in grade (auto)" },
];

import StatsEditor from "./StatsEditor.jsx";

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
            label="Banner image"
            hint="Wide background, ~1600×400px. Paste a link or upload. Blank for an accent gradient."
          >
            <MediaInput
              value={banner.imageUrl || ""}
              onChange={(imageUrl) => setBanner({ imageUrl })}
              maxDim={1600}
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
          <Field label="Left logo" hint="Square, ~128×128px. Paste a link or upload.">
            <MediaInput
              value={banner.logoUrl || ""}
              onChange={(logoUrl) => setBanner({ logoUrl })}
              maxDim={256}
            />
          </Field>
          <Field label="Right logo" hint="Square, ~128×128px. Paste a link or upload.">
            <MediaInput
              value={banner.logoUrl2 || ""}
              onChange={(logoUrl2) => setBanner({ logoUrl2 })}
              maxDim={256}
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

      {field.type === "tenure" && (
        <div className="grid gap-3 sm:col-span-3">
          <Field
            label="Counts days since"
            hint="Shows days since this date column. Rank changes stamp that date to today, resetting the count automatically."
          >
            <Select
              value={field.sourceFieldId || ""}
              onChange={(e) => update({ sourceFieldId: e.target.value })}
            >
              <option value="">Auto-detect (date column named “…promotion…”)</option>
              {(config.roster.memberFields || [])
                .filter((d) => d.type === "date")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={field.resetOnCategory !== false}
              onChange={(e) => update({ resetOnCategory: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Also reset when moved to a new category (rank changes always reset)
          </label>
        </div>
      )}

      {field.type === "select" && (
        <div className="grid gap-3 sm:col-span-3">
          <Field label="Options" hint="Separate with commas, e.g. Active, LOA, Inactive">
            <CommaListInput
              value={options}
              placeholder="Active, LOA, Inactive"
              onChange={(next) => update({ options: next })}
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

      <Panel className="p-5">
        <SectionHeader
          title="Department statistics"
          subtitle="The metrics panel above the roster, computed over the active subdivision. Roster editors can also adjust this from the roster itself (the Stats button)."
        />
        <StatsEditor />
      </Panel>
    </div>
  );
}
