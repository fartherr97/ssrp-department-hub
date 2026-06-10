import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Users,
  Columns3,
  UserPlus,
  Search,
  Check,
  Award,
  BarChart3,
  SlidersHorizontal,
  Undo2,
  Copy,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canEditSubdivision, canEditRosterStructure } from "../lib/permissions.js";
import { getSubPagePath, buildSubPath } from "../lib/navigation.js";
import { initials } from "../lib/user.js";
import {
  Button,
  IconButton,
  Panel,
  PageHeader,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Select,
  Badge,
  EmptyState,
  CommaListInput,
  MediaInput,
  Toast,
  useModalData,
} from "../components/common/index.jsx";
import useToast from "../hooks/useToast.js";
import * as R from "../lib/roster.js";
import StatsEditor from "./builder/StatsEditor.jsx";

// True when the active drag is a roster member (ignore files/text drags).
const hasMemberDrag = (e) =>
  Array.from(e.dataTransfer?.types || []).includes("text/roster-member");

// Pick the field used for the status summary pills + status badges: a select
// field literally about "status", else the first select field.
function findStatusField(fields) {
  return (
    fields.find((f) => f.type === "select" && /status/i.test(`${f.label} ${f.id}`)) ||
    fields.find((f) => f.type === "select") ||
    null
  );
}

// Map a status value to a tone (badge classes + dot color). Order matters:
// "inactive" must be tested before "active".
const STATUS_TONES = [
  { test: /inactive/i, badge: "bg-slate-500/15 text-slate-300 border-slate-500/30", dot: "#94a3b8" },
  { test: /semi/i, badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "#f59e0b" },
  { test: /train/i, badge: "bg-blue-500/15 text-blue-300 border-blue-500/30", dot: "#3b82f6" },
  { test: /(loa|leave)/i, badge: "bg-purple-500/15 text-purple-300 border-purple-500/30", dot: "#a855f7" },
  { test: /(active|duty)/i, badge: "bg-green-500/15 text-green-300 border-green-500/30", dot: "#22c55e" },
  { test: /vacant/i, badge: "bg-slate-500/10 text-slate-400 border-slate-500/20", dot: "#64748b" },
];

function statusTone(value) {
  const hit = STATUS_TONES.find((t) => t.test.test(value || ""));
  return hit || { badge: "bg-slate-500/15 text-slate-300 border-slate-500/30", dot: "#94a3b8" };
}

// A select field renders as a colored status pill if it opts in (`pill`) or is
// the detected status field. A per-option color (optionColors) wins over the tone.
function isPillField(field, statusFieldId) {
  return field.type === "select" && (field.pill || field.id === statusFieldId);
}

// Checkbox / cert / pill columns are centered to line up under their headers.
function isCenteredField(field, statusFieldId) {
  return field.type === "checkbox" || field.type === "cert" || isPillField(field, statusFieldId);
}

function selectPillProps(field, value) {
  const custom = field.optionColors?.[value];
  if (custom) {
    return {
      style: {
        backgroundColor: `color-mix(in srgb, ${custom} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${custom} 45%, transparent)`,
        color: custom,
      },
      className: "",
    };
  }
  return { style: undefined, className: statusTone(value).badge };
}

// Dates are stored ISO (YYYY-MM-DD) but display as MM/DD/YYYY on one line.
function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value;
}

// Renders one member field cell by type: checkbox (✓), cert (CERTIFIED/N/A),
// colored status pill, auto time-in-grade, formatted date, or plain text.
function FieldValue({ field, value, statusFieldId, accent }) {
  if (field.type === "tenure" || field.type === "service") {
    if (value === null || value === undefined) return <span className="text-slate-600">—</span>;
    return (
      <span
        className="whitespace-nowrap font-semibold tabular-nums text-slate-200"
        title={
          field.type === "service"
            ? "Days since hire, updates automatically"
            : "Days since last promotion, updates automatically"
        }
      >
        {value}
      </span>
    );
  }
  if (field.type === "date" && value) {
    return <span className="whitespace-nowrap text-slate-300">{formatDate(value)}</span>;
  }
  if (field.type === "checkbox") {
    return value ? (
      <Check size={16} strokeWidth={3} className="mx-auto" style={{ color: accent }} />
    ) : (
      <span className="mx-auto block h-3.5 w-3.5 rounded-[3px] border border-white/15" />
    );
  }
  if (field.type === "cert") {
    return value ? (
      <span className="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-300">
        Certified
      </span>
    ) : (
      <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        N/A
      </span>
    );
  }
  if (value === undefined || value === null || value === "") {
    return <span className="text-slate-600">—</span>;
  }
  if (isPillField(field, statusFieldId)) {
    const p = selectPillProps(field, value);
    return (
      <span
        style={p.style}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${p.className}`}
      >
        {value}
      </span>
    );
  }
  return <span className="text-slate-300">{value}</span>;
}

// ─── Subdivision banner (department-style header for the active tab) ──────────

function RosterBanner({ sub, accent }) {
  const b = sub?.banner;
  const hasContent = b && (b.imageUrl || b.logoUrl || b.logoUrl2 || b.title || b.subtitle);
  if (!hasContent) return null;
  const title = b.title || sub.name;
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10">
      {b.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${b.imageUrl})` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: b.imageUrl
            ? `linear-gradient(90deg, rgba(6,12,24,0.92) 0%, rgba(6,12,24,0.7) 55%, color-mix(in srgb, ${accent} 24%, rgba(6,12,24,0.5)) 100%)`
            : `linear-gradient(120deg, color-mix(in srgb, ${accent} 22%, #0b1424) 0%, #0b1424 62%)`,
        }}
      />
      <div className="relative flex items-center gap-4 px-5 py-6 sm:px-8">
        {b.logoUrl && (
          <img src={b.logoUrl} alt="" className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <h2
            className="truncate text-xl font-extrabold tracking-tight sm:text-3xl"
            style={{ color: accent }}
          >
            {title}
          </h2>
          {b.subtitle && (
            <div className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-sm">
              {b.subtitle}
            </div>
          )}
        </div>
        {b.logoUrl2 ? (
          <img src={b.logoUrl2} alt="" className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" />
        ) : b.logoUrl ? (
          <div className="hidden h-14 w-14 shrink-0 sm:block sm:h-16 sm:w-16" />
        ) : null}
      </div>
    </div>
  );
}

// ─── Department stats box ─────────────────────────────────────────────────────

function computeStat(item, groups, statusField) {
  if (item.mode === "manual") return item.value || "—";
  let count = 0;
  for (const g of groups) {
    for (const m of g.members) {
      if (item.mode === "total") count++;
      else if (item.mode === "status") {
        if (statusField && m.fields?.[statusField.id] === item.statusValue) count++;
      } else if (item.mode === "cert") {
        if (item.fieldId && m.fields?.[item.fieldId]) count++;
      }
    }
  }
  return count;
}

function StatsPanel({ stats, groups, statusField, accent, canEdit, onEdit }) {
  if (!stats?.show || !stats.items?.length) return null;
  return (
    <Panel className="mb-4 overflow-hidden">
      <div
        className="flex items-center justify-between border-b border-white/10 px-4 py-2.5"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={15} style={{ color: accent }} />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-200">
            {stats.title || "Department Statistics"}
          </span>
        </div>
        {canEdit && (
          <IconButton
            icon={SlidersHorizontal}
            label="Choose what displays here"
            onClick={onEdit}
            className="h-7 w-7"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            style={{ borderLeft: `3px solid ${item.color || accent}` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">
              {item.label}
            </div>
            <div
              className="mt-0.5 text-2xl font-black tabular-nums"
              style={{ color: item.color || accent }}
            >
              {computeStat(item, groups, statusField)}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Member avatar ───────────────────────────────────────────────────────────

function MemberAvatar({ member }) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name}
        className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs font-bold text-slate-300">
      {initials(member.name)}
    </div>
  );
}

// ─── Click-to-copy Discord ID ────────────────────────────────────────────────

function DiscordIdChip({ id }) {
  const [copied, setCopied] = useState(false);

  async function copy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // Clipboard API needs a secure context; fall back to the legacy path.
      const ta = document.createElement("textarea");
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (copied) {
    return (
      <span className="anim-fade-in flex items-center gap-1 text-[11px] font-semibold text-green-300">
        <Check size={11} strokeWidth={3} />
        Copied!
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Click to copy Discord ID"
      className="group/id flex max-w-full items-center gap-1 font-mono text-[11px] text-slate-500 transition hover:text-slate-300"
    >
      <span className="truncate">{id}</span>
      <Copy size={10} className="shrink-0 opacity-0 transition group-hover/id:opacity-100" />
    </button>
  );
}

// ─── Member edit modal ───────────────────────────────────────────────────────

function MemberModal({ open, onClose, fields, categories, rankTitles, categoryId, member, onSave }) {
  const [draft, setDraft] = useState(member);
  const [targetCat, setTargetCat] = useState(categoryId);

  if (open && draft.id !== member.id) {
    setDraft(member);
    setTargetCat(categoryId);
  }

  function setField(fieldId, value) {
    setDraft((d) => ({ ...d, fields: { ...(d.fields || {}), [fieldId]: value } }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member.isNew ? "Add member" : "Edit member"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft, targetCat)}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={draft.name || ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Member name"
            />
          </Field>
          <Field label="Rank">
            <Select
              value={draft.rank || ""}
              onChange={(e) => setDraft({ ...draft, rank: e.target.value })}
            >
              <option value="">—</option>
              {rankTitles.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discord ID" hint="Used by the backend to match Discord roles.">
            <Input
              value={draft.discordId || ""}
              onChange={(e) => setDraft({ ...draft, discordId: e.target.value })}
              placeholder="000000000000000000"
            />
          </Field>
          <Field label="Avatar" hint="Square, ~128×128px. Paste a link or upload.">
            <MediaInput
              value={draft.avatarUrl || ""}
              maxDim={256}
              onChange={(avatarUrl) => setDraft({ ...draft, avatarUrl })}
            />
          </Field>
        </div>

        {fields.map((f) => {
          if (f.type === "tenure" || f.type === "service") {
            return (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
              >
                <span className="text-sm font-medium text-cad-text">{f.label}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-cad-muted">
                  Calculated automatically
                </span>
              </div>
            );
          }
          if (f.type === "checkbox" || f.type === "cert") {
            return (
              <label
                key={f.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-app-input px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={!!draft.fields?.[f.id]}
                  onChange={(e) => setField(f.id, e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm font-medium text-cad-text">{f.label}</span>
                <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-cad-muted">
                  {f.type === "cert" ? "Certified" : "Yes / No"}
                </span>
              </label>
            );
          }
          return (
            <Field key={f.id} label={f.label}>
              {f.type === "select" ? (
                <Select
                  value={draft.fields?.[f.id] || ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                >
                  <option value="">—</option>
                  {(f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.type === "date" ? "date" : "text"}
                  value={draft.fields?.[f.id] || ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                />
              )}
            </Field>
          );
        })}

        <Field label="Category" hint="Move this member to a different category.">
          <Select value={targetCat} onChange={(e) => setTargetCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

// ─── Category edit modal (the colored grouping band) ─────────────────────────

function CategoryModal({ open, onClose, category, onSave }) {
  const [draft, setDraft] = useState(category);
  if (open && draft.id !== category.id) setDraft(category);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category.isNew ? "Add category" : "Edit category"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Category name" hint="The colored grouping band, e.g. Command Staff.">
          <Input
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.color || "#3b82f6"}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <Input
              value={draft.color || ""}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="font-mono"
            />
          </div>
        </Field>
        <Field
          label="Insignia image URL"
          hint="Optional icon on the category header, ~64×64px (PNG/SVG)."
        >
          <div className="flex items-center gap-2">
            {draft.insigniaUrl && (
              <img src={draft.insigniaUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
            )}
            <Input
              value={draft.insigniaUrl || ""}
              onChange={(e) => setDraft({ ...draft, insigniaUrl: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

// ─── Rank titles manager (Colonel, Captain… shown in the Rank column) ────────

function RankTitlesModal({ open, onClose, subId }) {
  const { config, mutate } = useConfig();
  const sub = R.findSubdivision(config, subId);
  const ranks = sub?.ranks || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ranks, ${sub?.name || ""}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="grid gap-3">
        <p className="text-sm text-slate-400">
          Rank titles a member can hold (e.g. Colonel, Captain). The insignia shows
          in the Rank column next to the title. A callsign format like “91##” lets
          the promotion tool hand out the next free callsign (9100, 9101…) automatically.
          Set a Discord role ID to auto-update members' ranks when the bot sees their
          Discord roles change (requires the backend bot).
        </p>
        {ranks.map((rt, idx) => (
          <div
            key={rt.id}
            className="grid gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Rank name">
                <Input
                  value={rt.name}
                  onChange={(e) => mutate(R.updateRank(config, subId, rt.id, { name: e.target.value }))}
                />
              </Field>
              <Field label="Insignia · ~64×64">
                <MediaInput
                  value={rt.insigniaUrl || ""}
                  maxDim={128}
                  onChange={(insigniaUrl) => mutate(R.updateRank(config, subId, rt.id, { insigniaUrl }))}
                />
              </Field>
            </div>
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Callsign format" hint="# auto-numbers, e.g. 91##">
                <Input
                  value={rt.callsignFormat || ""}
                  placeholder="91##"
                  onChange={(e) =>
                    mutate(R.updateRank(config, subId, rt.id, { callsignFormat: e.target.value }))
                  }
                />
              </Field>
              <Field label="Discord role ID" hint="For auto rank sync via the bot.">
                <Input
                  value={rt.discordRoleId || ""}
                  placeholder="000000000000000000"
                  onChange={(e) =>
                    mutate(R.updateRank(config, subId, rt.id, { discordRoleId: e.target.value.trim() }))
                  }
                />
              </Field>
              <div className="mb-0.5 flex items-center justify-end gap-1">
              <IconButton
              icon={ChevronUp}
              label="Move up"
              disabled={idx === 0}
              onClick={() => mutate(R.moveRank(config, subId, rt.id, -1))}
              className="disabled:opacity-30"
            />
            <IconButton
              icon={ChevronDown}
              label="Move down"
              disabled={idx === ranks.length - 1}
              onClick={() => mutate(R.moveRank(config, subId, rt.id, 1))}
              className="disabled:opacity-30"
            />
            <IconButton
              icon={Trash2}
              label="Delete rank"
              onClick={() => mutate(R.deleteRank(config, subId, rt.id))}
              className="hover:border-red-500/40 hover:text-red-300"
            />
            </div>
            </div>
          </div>
        ))}
        {ranks.length === 0 && <p className="text-sm text-slate-500">No ranks yet.</p>}
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => mutate(R.addRank(config, subId, { name: "New Rank" }))}
        >
          Add rank
        </Button>
      </div>
    </Modal>
  );
}

// ─── Subdivision rename modal ────────────────────────────────────────────────

function SubdivisionModal({ open, onClose, subdivision, onSave }) {
  const [name, setName] = useState(subdivision.name);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subdivision.isNew ? "Add subdivision" : "Rename subdivision"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(name)}>Save</Button>
        </>
      }
    >
      <Field label="Subdivision name" hint="Shown as a tab at the top of the roster.">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

// ─── Columns (shared member fields) editor ───────────────────────────────────

function ColumnsModal({ open, onClose }) {
  const { config, mutate } = useConfig();
  const fields = config.roster.memberFields || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Roster columns"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="grid gap-3">
        <p className="text-sm text-slate-400">
          Custom fields shown for every member, across all subdivisions.
        </p>
        {fields.map((f) => (
          <div
            key={f.id}
            className="grid grid-cols-[1fr_auto_auto] items-end gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
          >
            <Field label="Label">
              <Input
                value={f.label}
                onChange={(e) =>
                  mutate(R.updateMemberField(config, f.id, { label: e.target.value }))
                }
              />
            </Field>
            <Field label="Type">
              <Select
                value={f.type}
                onChange={(e) =>
                  mutate(R.updateMemberField(config, f.id, { type: e.target.value }))
                }
              >
                <option value="text">Text</option>
                <option value="select">Dropdown</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="cert">Certification</option>
                <option value="tenure">Time in grade (auto)</option>
                <option value="service">Days in service (auto)</option>
              </Select>
            </Field>
            <IconButton
              icon={Trash2}
              label="Delete field"
              onClick={() => mutate(R.deleteMemberField(config, f.id))}
              className="mb-0.5 hover:border-red-500/40 hover:text-red-300"
            />
            {f.type === "select" && (
              <div className="col-span-3">
                <Field label="Options" hint="Separate with commas, e.g. Active, LOA, Inactive">
                  <CommaListInput
                    value={f.options || []}
                    placeholder="Active, LOA, Inactive"
                    onChange={(options) =>
                      mutate(R.updateMemberField(config, f.id, { options }))
                    }
                  />
                </Field>
              </div>
            )}
            {(f.type === "tenure" || f.type === "service") && (
              <div className="col-span-3 grid gap-3">
                <Field
                  label="Counts days since"
                  hint={
                    f.type === "service"
                      ? "Shows days since this date column, e.g. the member's hire date. Never reset automatically."
                      : "Shows days since this date column, promotions reset it automatically."
                  }
                >
                  <Select
                    value={f.sourceFieldId || ""}
                    onChange={(e) =>
                      mutate(R.updateMemberField(config, f.id, { sourceFieldId: e.target.value }))
                    }
                  >
                    <option value="">
                      {f.type === "service"
                        ? "Auto-detect (date column named hire / entry / join)"
                        : "Auto-detect (date column named “…promotion…”)"}
                    </option>
                    {fields
                      .filter((d) => d.type === "date")
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                  </Select>
                </Field>
                {f.type === "tenure" && (
                <Field
                  label="Resets when"
                  hint="What stamps the date to today, restarting the count."
                >
                  <Select
                    value={f.resetOn || "category"}
                    onChange={(e) =>
                      mutate(R.updateMemberField(config, f.id, { resetOn: e.target.value }))
                    }
                  >
                    <option value="category">Moved to a new category</option>
                    <option value="rank">Rank changes</option>
                    <option value="both">Rank or category changes</option>
                    <option value="never">Never (manual date edits only)</option>
                  </Select>
                </Field>
                )}
              </div>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => mutate(R.addMemberField(config, { label: "New Field", type: "text" }))}
        >
          Add column
        </Button>
      </div>
    </Modal>
  );
}

// ─── Subdivision tab bar ─────────────────────────────────────────────────────

function SubdivisionTabs({ subdivisions, activeId, canEdit, onSelect, onAdd, onRename, onMove, onDelete }) {
  const active = subdivisions.find((s) => s.id === activeId);
  const idx = subdivisions.findIndex((s) => s.id === activeId);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {subdivisions.map((s) => {
          const isActive = s.id === activeId;
          const count = (s.categories || []).reduce((n, c) => n + c.members.length, 0);
          const tabAccent = s.accent || "var(--color-primary)";
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={
                isActive
                  ? {
                      borderColor: `color-mix(in srgb, ${tabAccent} 55%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${tabAccent} 16%, transparent)`,
                    }
                  : undefined
              }
              className={`press flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                isActive
                  ? "text-white"
                  : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {s.name}
              <span
                style={
                  isActive
                    ? { backgroundColor: `color-mix(in srgb, ${tabAccent} 30%, transparent)` }
                    : undefined
                }
                className={`rounded-full px-1.5 text-[11px] font-bold ${
                  isActive ? "text-white" : "bg-white/10 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        {canEdit && (
          <IconButton icon={Plus} label="Add subdivision" onClick={onAdd} className="rounded-xl" />
        )}
      </div>

      {canEdit && active && (
        <div className="ml-auto flex items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            label="Move subdivision left"
            disabled={idx <= 0}
            onClick={() => onMove(active.id, -1)}
            className="disabled:opacity-30"
          />
          <IconButton
            icon={ChevronRight}
            label="Move subdivision right"
            disabled={idx >= subdivisions.length - 1}
            onClick={() => onMove(active.id, 1)}
            className="disabled:opacity-30"
          />
          <IconButton icon={Pencil} label="Rename subdivision" onClick={() => onRename(active)} />
          <IconButton
            icon={Trash2}
            label="Delete subdivision"
            disabled={subdivisions.length <= 1}
            onClick={() => onDelete(active)}
            className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
          />
        </div>
      )}
    </div>
  );
}

// ─── Stat summary pills ──────────────────────────────────────────────────────

function StatPills({ total, statusField, counts }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-primary)]/10 px-3 py-1 text-sm font-bold text-white">
        Total <span className="text-[var(--color-primary)]">{total}</span>
      </span>
      {statusField?.options?.map((opt) => {
        const tone = statusTone(opt);
        return (
          <span
            key={opt}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[var(--color-surface-2)] px-3 py-1 text-sm font-semibold text-slate-300"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.dot }} />
            {opt} <span className="text-white">{counts[opt] || 0}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Member table row ────────────────────────────────────────────────────────

function MemberRow({ member, category, fields, statusFieldId, accent, rankById, canEdit, onEdit, onDelete, onDragStart, onDragEnd, onRowDrop, dropTarget, setDropTarget, selected, onToggleSelect }) {
  const rt = rankById[member.rank];
  const isDropTarget =
    dropTarget && dropTarget.catId === category.id && dropTarget.memberId === member.id;
  return (
    <tr
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e, category.id, member.id)}
      onDragEnd={() => canEdit && onDragEnd()}
      onDragOver={(e) => {
        if (!canEdit || !hasMemberDrag(e)) return;
        e.preventDefault();
        if (!isDropTarget) setDropTarget({ catId: category.id, memberId: member.id });
      }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.stopPropagation(); // don't also fire the category-level drop
        onRowDrop(e, category.id, member.id);
      }}
      style={isDropTarget ? { boxShadow: "inset 0 3px 0 0 var(--color-primary)" } : undefined}
      className={`group border-t border-white/5 transition hover:bg-white/[0.03] ${
        selected ? "bg-[color:var(--color-primary)]/8" : ""
      } ${isDropTarget ? "bg-[color:var(--color-primary)]/10" : ""}`}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          {canEdit && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(category.id, member.id)}
              title="Select for promotion / demotion"
              className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-primary)]"
            />
          )}
          {canEdit && (
            <GripVertical
              size={14}
              className="shrink-0 cursor-grab text-slate-600 group-hover:text-slate-400"
            />
          )}
          <MemberAvatar member={member} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{member.name}</div>
            {member.discordId && <DiscordIdChip id={member.discordId} />}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 align-middle text-sm">
        {rt ? (
          <div className="flex items-center gap-2">
            {rt.insigniaUrl && (
              <img src={rt.insigniaUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
            )}
            <span className="font-medium text-slate-200">{rt.name}</span>
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      {fields.map((f) => (
        <td
          key={f.id}
          className={`px-3 py-2.5 align-middle text-sm ${
            isCenteredField(f, statusFieldId) ? "text-center" : ""
          }`}
        >
          <FieldValue
            field={f}
            value={
              f.type === "tenure" || f.type === "service"
                ? R.tenureDays(member, f, fields)
                : member.fields?.[f.id]
            }
            statusFieldId={statusFieldId}
            accent={accent}
          />
        </td>
      ))}
      {canEdit && (
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
            <IconButton icon={Pencil} label="Edit member" onClick={() => onEdit(category.id, member)} />
            <IconButton
              icon={Trash2}
              label="Remove member"
              onClick={() => onDelete(category.id, member)}
              className="hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── One subdivision's table (shared by tabbed + grid layouts) ───────────────

function SubRoster({
  sub,
  fields,
  statusField,
  accent,
  canEdit,
  categoryFilter = "all",
  matches,
  filtering,
  dragOverCat,
  setDragOverCat,
  dropTarget,
  setDropTarget,
  onDragStart,
  onDragEnd,
  onDrop,
  onRowDrop,
  selectedIds,
  onToggleSelect,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onMoveCategory,
  onEditCategory,
  onDeleteCategory,
  compact = false,
}) {
  const categories = sub.categories || [];
  const rankById = useMemo(
    () => Object.fromEntries((sub.ranks || []).map((r) => [r.id, r])),
    [sub.ranks]
  );
  const colCount = 2 + fields.length + (canEdit ? 1 : 0);
  const visible = categories.filter((c) => categoryFilter === "all" || c.id === categoryFilter);

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse text-left ${compact ? "min-w-[520px]" : "min-w-[760px]"}`}
      >
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5 font-semibold">Name</th>
            <th className="px-3 py-2.5 font-semibold">Rank</th>
            {fields.map((f) => (
              <th
                key={f.id}
                className={`px-3 py-2.5 font-semibold ${
                  isCenteredField(f, statusField?.id) ? "text-center" : ""
                }`}
              >
                {f.label}
              </th>
            ))}
            {canEdit && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        {visible.map((cat) => {
          const members = cat.members.filter(matches);
          if (filtering && members.length === 0) return null;
          return (
            <tbody
              key={cat.id}
              onDragOver={(e) => {
                if (!canEdit || !hasMemberDrag(e)) return;
                e.preventDefault();
                setDragOverCat(cat.id);
              }}
              onDragLeave={() => setDragOverCat((c) => (c === cat.id ? null : c))}
              onDrop={(e) => canEdit && onDrop(e, sub.id, cat.id)}
              className={
                dragOverCat === cat.id
                  ? "bg-[color:var(--color-primary)]/10 outline outline-1 -outline-offset-1 outline-[color:var(--color-border-strong)]"
                  : ""
              }
            >
              {/* Colored category band header */}
              <tr
                onDragOver={(e) => {
                  if (!canEdit || !hasMemberDrag(e)) return;
                  e.preventDefault();
                  // Hovering the band itself appends to the end, no row line.
                  setDropTarget(null);
                }}
              >
                <td
                  colSpan={colCount}
                  className="border-t border-white/10 px-3 py-2"
                  style={{
                    background: `linear-gradient(90deg, ${cat.color}1f 0%, transparent 60%)`,
                    borderLeft: `3px solid ${cat.color || "#3b82f6"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {cat.insigniaUrl && (
                      <img src={cat.insigniaUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
                    )}
                    <span
                      className="text-xs font-black uppercase tracking-[0.15em]"
                      style={{ color: cat.color || "#3b82f6" }}
                    >
                      {cat.name}
                    </span>
                    <Badge color={cat.color}>{cat.members.length}</Badge>
                    {canEdit && (
                      <div className="ml-auto flex items-center gap-1">
                        <IconButton
                          icon={ChevronUp}
                          label="Move category up"
                          disabled={categories.indexOf(cat) === 0}
                          onClick={() => onMoveCategory(sub.id, cat.id, -1)}
                          className="h-7 w-7 disabled:opacity-30"
                        />
                        <IconButton
                          icon={ChevronDown}
                          label="Move category down"
                          disabled={categories.indexOf(cat) === categories.length - 1}
                          onClick={() => onMoveCategory(sub.id, cat.id, 1)}
                          className="h-7 w-7 disabled:opacity-30"
                        />
                        <IconButton
                          icon={UserPlus}
                          label="Add member"
                          onClick={() => onAddMember(sub.id, cat.id)}
                          className="h-7 w-7"
                        />
                        <IconButton
                          icon={Pencil}
                          label="Edit category"
                          onClick={() => onEditCategory(sub.id, cat)}
                          className="h-7 w-7"
                        />
                        <IconButton
                          icon={Trash2}
                          label="Delete category"
                          onClick={() => onDeleteCategory(sub.id, cat)}
                          className="h-7 w-7 hover:border-red-500/40 hover:text-red-300"
                        />
                      </div>
                    )}
                  </div>
                </td>
              </tr>

              {members.length === 0 ? (
                <tr
                  onDragOver={(e) => {
                    if (!canEdit || !hasMemberDrag(e)) return;
                    e.preventDefault();
                    setDropTarget(null);
                  }}
                >
                  <td colSpan={colCount} className="px-3 py-3 text-sm text-slate-500">
                    No members{canEdit ? ", add one or drag a member here." : "."}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    category={cat}
                    fields={fields}
                    statusFieldId={statusField?.id}
                    accent={accent}
                    rankById={rankById}
                    canEdit={canEdit}
                    onEdit={(catId, m) => onEditMember(sub.id, catId, m)}
                    onDelete={(catId, m) => onDeleteMember(sub.id, catId, m)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onRowDrop={(e, catId, beforeId) => onRowDrop(e, sub.id, catId, beforeId)}
                    dropTarget={dropTarget}
                    setDropTarget={setDropTarget}
                    selected={Boolean(selectedIds?.has(member.id))}
                    onToggleSelect={(catId, id) => onToggleSelect(sub.id, catId, id)}
                  />
                ))
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Roster({ user, page }) {
  const { config, mutate, undo, canUndo } = useConfig();
  // Structural edits (subdivisions, shared columns) vs. per-subdivision editing.
  const canEditStructure = canEditRosterStructure(user, config);
  const fields = config.roster.memberFields || [];
  const subdivisions = config.roster.subdivisions || [];
  const statusField = findStatusField(fields);
  const pageId = page?.id || "roster";

  // Subdivision tabs are routable: /roster/sub-xyz.
  const [activeSubId, setActiveSubId] = useState(() => {
    const fromUrl = getSubPagePath();
    return subdivisions.some((s) => s.id === fromUrl) ? fromUrl : subdivisions[0]?.id;
  });
  function selectSub(id, { push = true } = {}) {
    setActiveSubId(id);
    const path = buildSubPath(pageId, id);
    if (push) window.history.pushState(null, "", path);
    else window.history.replaceState(null, "", path);
  }
  useEffect(() => {
    const onPop = () => {
      const fromUrl = getSubPagePath();
      const subs = config.roster.subdivisions || [];
      setActiveSubId(subs.some((s) => s.id === fromUrl) ? fromUrl : subs[0]?.id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [config]);
  const activeSub = subdivisions.find((s) => s.id === activeSubId) || subdivisions[0];
  const subId = activeSub?.id;
  const categories = activeSub?.categories || [];
  const totalMembers = categories.reduce((n, c) => n + c.members.length, 0);
  const accent = activeSub?.accent || "var(--color-primary)";
  const canEditActive = canEditSubdivision(user, config, activeSub);
  // A subdivision may carry its own stats panel; otherwise the shared one.
  const stats = activeSub?.stats ?? config.roster.stats;
  const statsShown = Boolean(stats?.show && stats.items?.length);

  // Layout: "tabs" (one subdivision at a time) or "grid" (all side-by-side).
  const layout = config.roster.layout === "grid" ? "grid" : "tabs";
  const allCategories = useMemo(
    () => subdivisions.flatMap((s) => s.categories || []),
    [subdivisions]
  );

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [memberModal, setMemberModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [rankTitlesSubId, setRankTitlesSubId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);
  // The row a dragged member would land before (insertion indicator).
  const [dropTarget, setDropTarget] = useState(null);
  // Mass promotion/demotion: selected member ids (within one subdivision).
  const [selected, setSelected] = useState(() => new Set());
  const [selSubId, setSelSubId] = useState(null);
  const [promoRank, setPromoRank] = useState("");
  const { toast, show } = useToast();

  // Status counts for the summary pills (across the whole active subdivision).
  const statusCounts = useMemo(() => {
    const counts = {};
    if (statusField) {
      for (const cat of categories) {
        for (const m of cat.members) {
          const v = m.fields?.[statusField.id];
          if (v) counts[v] = (counts[v] || 0) + 1;
        }
      }
    }
    return counts;
  }, [categories, statusField]);

  const q = query.trim().toLowerCase();
  function matches(member) {
    if (!q) return true;
    const hay = [member.name, member.discordId, ...Object.values(member.fields || {})]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }
  const filtering = q !== "" || categoryFilter !== "all";

  // ── Member handlers (subdivision + category aware) ──
  function openNewMember(forSubId, categoryId) {
    setMemberModal({
      subId: forSubId,
      categoryId,
      member: { id: R.uid("member"), name: "", rank: "", fields: {}, isNew: true },
    });
  }
  function openEditMember(forSubId, categoryId, member) {
    setMemberModal({ subId: forSubId, categoryId, member });
  }
  function saveMember(draft, targetCategory) {
    const { subId: mSub, categoryId, member: orig } = memberModal;
    const { isNew, ...clean } = draft;
    const catChanged = Boolean(targetCategory && targetCategory !== categoryId);
    mutate((cfg) => {
      // Promotion automation: a rank or category change stamps the promotion
      // date to today (resetting time in grade), unless the date was edited by
      // hand in this same save. New members default it to today when blank.
      const promoId = R.promotionDateFieldId(cfg);
      let fields = clean.fields || {};
      if (promoId) {
        const rankResets = !isNew && clean.rank !== orig.rank && R.tenureResetsOn(cfg, "rank");
        const catResets = catChanged && R.tenureResetsOn(cfg, "category");
        const editedByHand = (fields[promoId] || "") !== (orig.fields?.[promoId] || "");
        const blankOnNew = isNew && !fields[promoId];
        if (((rankResets || catResets) && !editedByHand) || blankOnNew) {
          fields = { ...fields, [promoId]: new Date().toISOString().slice(0, 10) };
        }
      }
      const next0 = { ...clean, fields };
      if (isNew) return R.addMember(cfg, mSub, categoryId, next0);
      let next = R.updateMember(cfg, mSub, categoryId, next0.id, next0);
      if (catChanged) {
        next = R.moveMember(next, mSub, categoryId, next0.id, targetCategory);
      }
      return next;
    });
    setMemberModal(null);
  }
  function confirmDeleteMember(forSubId, categoryId, member) {
    setConfirm({ type: "member", subId: forSubId, categoryId, member });
  }

  // ── Category handlers ──
  function openAddCategory(forSubId) {
    setCategoryModal({
      id: R.uid("cat"),
      name: "",
      color: "#3b82f6",
      insigniaUrl: "",
      isNew: true,
      subId: forSubId,
    });
  }
  function openEditCategory(forSubId, category) {
    setCategoryModal({ ...category, subId: forSubId });
  }
  function saveCategory(draft) {
    const targetSub = categoryModal.subId;
    const { isNew, ...clean } = draft;
    const patch = { name: clean.name, color: clean.color, insigniaUrl: clean.insigniaUrl || "" };
    mutate((cfg) =>
      isNew ? R.addCategory(cfg, targetSub, patch) : R.updateCategory(cfg, targetSub, clean.id, patch)
    );
    setCategoryModal(null);
  }
  function moveCategory(forSubId, categoryId, dir) {
    mutate(R.moveCategory(config, forSubId, categoryId, dir));
  }
  function confirmDeleteCategory(forSubId, category) {
    setConfirm({ type: "category", subId: forSubId, category });
  }

  // ── Subdivision handlers ──
  function saveSubdivision(name) {
    const sub = subModal;
    if (sub.isNew) {
      const newId = R.uid("sub");
      mutate((cfg) => R.addSubdivision(cfg, { id: newId, name: name || "New Subdivision" }));
      selectSub(newId);
    } else {
      mutate(R.updateSubdivision(config, sub.id, { name }));
    }
    setSubModal(null);
  }

  // ── Drag and drop (within a subdivision) ──
  function onDragStart(e, fromCatId, memberId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/roster-member", JSON.stringify({ fromCatId, memberId }));
  }
  function onDragEnd() {
    setDragOverCat(null);
    setDropTarget(null);
  }
  function onDrop(e, toSubId, toCatId) {
    e.preventDefault();
    setDragOverCat(null);
    setDropTarget(null);
    try {
      const { fromCatId, memberId } = JSON.parse(e.dataTransfer.getData("text/roster-member"));
      if (fromCatId !== toCatId) {
        // Category change resets time in grade (if the tenure column opts in).
        mutate((cfg) =>
          R.touchPromotionDateOnCategoryChange(
            R.moveMember(cfg, toSubId, fromCatId, memberId, toCatId),
            toSubId,
            toCatId,
            memberId
          )
        );
      }
    } catch {
      /* ignore malformed drop */
    }
  }

  // Drop directly on a row: place the member right before that row.
  function onRowDrop(e, toSubId, toCatId, beforeMemberId) {
    setDragOverCat(null);
    setDropTarget(null);
    try {
      const { fromCatId, memberId } = JSON.parse(e.dataTransfer.getData("text/roster-member"));
      if (memberId === beforeMemberId) return;
      mutate((cfg) => {
        let next = R.moveMemberBefore(cfg, toSubId, fromCatId, memberId, toCatId, beforeMemberId);
        if (fromCatId !== toCatId) {
          next = R.touchPromotionDateOnCategoryChange(next, toSubId, toCatId, memberId);
        }
        return next;
      });
    } catch {
      /* ignore malformed drop */
    }
  }

  // ── Mass promotion / demotion ──
  function toggleSelect(forSubId, _catId, memberId) {
    setSelected((prev) => {
      if (selSubId !== forSubId) {
        setSelSubId(forSubId);
        return new Set([memberId]);
      }
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }
  const selSub = subdivisions.find((s) => s.id === selSubId);
  function runPromotion() {
    const rank = (selSub?.ranks || []).find((r) => r.id === promoRank);
    mutate((cfg) => R.applyPromotion(cfg, selSubId, [...selected], { rankId: promoRank }));
    show(
      `${selected.size} member${selected.size === 1 ? "" : "s"} set to ${rank?.name || "new rank"}${
        rank?.callsignFormat ? ", callsigns & promotion dates updated" : ", promotion dates updated"
      }`
    );
    setSelected(new Set());
    setPromoRank("");
  }

  // Shared SubRoster wiring (same handlers for both layouts). `canEdit` is
  // passed per-usage since it depends on the subdivision.
  const subRosterProps = {
    fields,
    statusField,
    matches,
    filtering,
    dragOverCat,
    setDragOverCat,
    dropTarget,
    setDropTarget,
    onDragStart,
    onDragEnd,
    onDrop,
    onRowDrop,
    selectedIds: selected,
    onToggleSelect: toggleSelect,
    onAddMember: openNewMember,
    onEditMember: openEditMember,
    onDeleteMember: confirmDeleteMember,
    onMoveCategory: moveCategory,
    onEditCategory: openEditCategory,
    onDeleteCategory: confirmDeleteCategory,
  };

  // Modal wrappers: keep each modal mounted through its close animation and
  // remount it (fresh state) on every open.
  const memberM = useModalData(memberModal);
  const categoryM = useModalData(categoryModal);
  const subM = useModalData(subModal);
  const rankTitlesM = useModalData(rankTitlesSubId);
  const modalSub = memberM.data
    ? subdivisions.find((s) => s.id === memberM.data.subId)
    : null;

  return (
    <div>
      <PageHeader
        kicker="Personnel"
        title="Roster"
        subtitle={
          layout === "grid"
            ? `${subdivisions.length} subdivision${subdivisions.length === 1 ? "" : "s"} · ${allCategories.reduce(
                (n, c) => n + c.members.length,
                0
              )} members`
            : activeSub
            ? `${activeSub.name} · ${totalMembers} member${totalMembers === 1 ? "" : "s"}`
            : "No subdivisions yet."
        }
        actions={
          (canEditStructure || canEditActive) && (
            <>
              <Button
                variant="secondary"
                icon={Undo2}
                disabled={!canUndo}
                title={canUndo ? "Revert the most recent change (roster or site-wide)" : "Nothing to undo yet"}
                onClick={() => {
                  if (undo()) show("Last change undone");
                }}
              >
                Undo
              </Button>
              {canEditStructure && (
                <>
                  <Button variant="secondary" icon={Columns3} onClick={() => setColumnsOpen(true)}>
                    Columns
                  </Button>
                  <Button variant="secondary" icon={BarChart3} onClick={() => setStatsOpen(true)}>
                    Stats
                  </Button>
                </>
              )}
              {layout === "tabs" && subId && canEditActive && (
                <>
                  <Button variant="secondary" icon={Award} onClick={() => setRankTitlesSubId(subId)}>
                    Add rank
                  </Button>
                  <Button icon={Plus} onClick={() => openAddCategory(subId)}>
                    Add category
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {layout === "tabs" ? (
        <>
          <SubdivisionTabs
            subdivisions={subdivisions}
            activeId={subId}
            canEdit={canEditStructure}
            onSelect={(id) => {
              selectSub(id);
              setCategoryFilter("all");
            }}
            onAdd={() => setSubModal({ id: R.uid("sub"), name: "", isNew: true })}
            onRename={(sub) => setSubModal(sub)}
            onMove={(id, dir) => mutate(R.moveSubdivision(config, id, dir))}
            onDelete={(sub) => setConfirm({ type: "subdivision", subdivision: sub })}
          />

          <RosterBanner sub={activeSub} accent={accent} />
          <StatsPanel
            stats={stats}
            groups={categories}
            statusField={statusField}
            accent={accent}
            canEdit={canEditStructure}
            onEdit={() => setStatsOpen(true)}
          />

          {/* Summary + controls */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {statsShown ? (
              <div />
            ) : (
              <StatPills total={totalMembers} statusField={statusField} counts={statusCounts} />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID, field…"
                  className="w-56 pl-9"
                />
              </div>
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-44">
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {categories.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No categories yet"
              subtitle={`Add your first category to start building the ${activeSub?.name || "roster"}.`}
              action={
                canEditActive && (
                  <Button icon={Plus} onClick={() => openAddCategory(subId)}>
                    Add category
                  </Button>
                )
              }
            />
          ) : (
            <Panel className="overflow-hidden">
              <SubRoster
                sub={activeSub}
                accent={accent}
                categoryFilter={categoryFilter}
                canEdit={canEditActive}
                {...subRosterProps}
              />
            </Panel>
          )}
        </>
      ) : (
        <>
          {/* Grid layout, every subdivision side-by-side */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {canEditStructure && (
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setSubModal({ id: R.uid("sub"), name: "", isNew: true })}
                >
                  Add subdivision
                </Button>
              )}
            </div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, ID, field…"
                className="w-full pl-9 sm:w-64"
              />
            </div>
          </div>

          <StatsPanel
            stats={config.roster.stats}
            groups={allCategories}
            statusField={statusField}
            accent="var(--color-primary)"
            canEdit={canEditStructure}
            onEdit={() => setStatsOpen(true)}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {subdivisions.map((s) => {
              const sAccent = s.accent || "var(--color-primary)";
              const cats = s.categories || [];
              const count = cats.reduce((n, c) => n + c.members.length, 0);
              const canEditCard = canEditSubdivision(user, config, s);
              return (
                <Panel key={s.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
                    style={{ borderLeft: `3px solid ${sAccent}` }}
                  >
                    {s.banner?.logoUrl && (
                      <img src={s.banner.logoUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {s.banner?.title || s.name}
                      </div>
                      {s.banner?.subtitle && (
                        <div className="truncate text-[11px] uppercase tracking-wide text-slate-500">
                          {s.banner.subtitle}
                        </div>
                      )}
                    </div>
                    <span
                      className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: `color-mix(in srgb, ${sAccent} 30%, transparent)` }}
                    >
                      {count}
                    </span>
                    {(canEditCard || canEditStructure) && (
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        {canEditCard && (
                          <>
                            <IconButton
                              icon={Award}
                              label="Manage ranks"
                              onClick={() => setRankTitlesSubId(s.id)}
                              className="h-7 w-7"
                            />
                            <IconButton
                              icon={Plus}
                              label="Add category"
                              onClick={() => openAddCategory(s.id)}
                              className="h-7 w-7"
                            />
                          </>
                        )}
                        {canEditStructure && (
                          <>
                            <IconButton
                              icon={Pencil}
                              label="Rename subdivision"
                              onClick={() => setSubModal(s)}
                              className="h-7 w-7"
                            />
                            <IconButton
                              icon={ChevronLeft}
                              label="Move left"
                              disabled={subdivisions.indexOf(s) === 0}
                              onClick={() => mutate(R.moveSubdivision(config, s.id, -1))}
                              className="h-7 w-7 disabled:opacity-30"
                            />
                            <IconButton
                              icon={ChevronRight}
                              label="Move right"
                              disabled={subdivisions.indexOf(s) === subdivisions.length - 1}
                              onClick={() => mutate(R.moveSubdivision(config, s.id, 1))}
                              className="h-7 w-7 disabled:opacity-30"
                            />
                            <IconButton
                              icon={Trash2}
                              label="Delete subdivision"
                              disabled={subdivisions.length <= 1}
                              onClick={() => setConfirm({ type: "subdivision", subdivision: s })}
                              className="h-7 w-7 hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {cats.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500">
                      No categories yet{canEditCard ? ", use + to add one." : "."}
                    </div>
                  ) : (
                    <SubRoster sub={s} accent={sAccent} compact canEdit={canEditCard} {...subRosterProps} />
                  )}
                </Panel>
              );
            })}
          </div>
        </>
      )}

      <Toast message={toast} />

      {/* Promotion / demotion bar, appears when members are selected */}
      {selected.size > 0 && selSub && canEditSubdivision(user, config, selSub) && (
        <div className="fixed bottom-6 left-1/2 z-[90] w-[min(94vw,640px)] -translate-x-1/2">
          <Panel className="flex flex-wrap items-center gap-2 p-3 shadow-2xl shadow-black/60">
            <span className="rounded-full bg-[color:var(--color-primary)]/15 px-3 py-1 text-sm font-bold text-white">
              {selected.size} selected
            </span>
            <Select
              value={promoRank}
              onChange={(e) => setPromoRank(e.target.value)}
              className="w-48"
              placeholder="Choose new rank…"
            >
              <option value="">Choose new rank…</option>
              {(selSub.ranks || []).map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </Select>
            <Button disabled={!promoRank} onClick={runPromotion}>
              Promote / Demote
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(new Set());
                setPromoRank("");
              }}
            >
              Clear
            </Button>
            <p className="w-full text-[11px] text-slate-500">
              Sets the new rank, updates Date of Promotion per your Time in Grade “resets
              when” setting, and auto-assigns callsigns when the rank has a callsign format
              (set in Ranks).
            </p>
          </Panel>
        </div>
      )}

      {/* Modals (shared by both layouts) */}
      {memberM.data && (
        <MemberModal
          key={memberM.key}
          open={memberM.open}
          onClose={() => setMemberModal(null)}
          fields={fields}
          categories={modalSub?.categories || categories}
          rankTitles={modalSub?.ranks || []}
          categoryId={memberM.data.categoryId}
          member={memberM.data.member}
          onSave={saveMember}
        />
      )}
      {categoryM.data && (
        <CategoryModal
          key={categoryM.key}
          open={categoryM.open}
          onClose={() => setCategoryModal(null)}
          category={categoryM.data}
          onSave={saveCategory}
        />
      )}
      {subM.data && (
        <SubdivisionModal
          key={subM.key}
          open={subM.open}
          onClose={() => setSubModal(null)}
          subdivision={subM.data}
          onSave={saveSubdivision}
        />
      )}
      <ColumnsModal open={columnsOpen} onClose={() => setColumnsOpen(false)} />
      <Modal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        title="Department statistics"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setStatsOpen(false)}>
            Done
          </Button>
        }
      >
        <p className="mb-4 text-sm text-slate-400">
          Choose what the statistics panel displays. Metrics are computed over the
          subdivision being viewed; changes apply instantly. By default every
          subdivision shares one panel, or give this one its own below.
        </p>
        <StatsEditor subId={layout === "tabs" ? subId : null} />
      </Modal>
      {rankTitlesM.data && (
        <RankTitlesModal
          open={rankTitlesM.open}
          onClose={() => setRankTitlesSubId(null)}
          subId={rankTitlesM.data}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.type === "category"
            ? "Delete category?"
            : confirm?.type === "subdivision"
            ? "Delete subdivision?"
            : "Remove member?"
        }
        message={
          confirm?.type === "category"
            ? `Delete "${confirm?.category?.name}" and all ${confirm?.category?.members?.length || 0} member(s) in it? This can't be undone.`
            : confirm?.type === "subdivision"
            ? `Delete the "${confirm?.subdivision?.name}" subdivision and its entire roster? This can't be undone.`
            : `Remove "${confirm?.member?.name}" from the roster?`
        }
        confirmLabel={
          confirm?.type === "category"
            ? "Delete category"
            : confirm?.type === "subdivision"
            ? "Delete subdivision"
            : "Remove"
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.type === "category") {
            mutate(R.deleteCategory(config, confirm.subId, confirm.category.id));
          } else if (confirm.type === "subdivision") {
            mutate(R.deleteSubdivision(config, confirm.subdivision.id));
            if (confirm.subdivision.id === activeSubId) {
              const fallback = subdivisions.find((s) => s.id !== confirm.subdivision.id);
              if (fallback) selectSub(fallback.id, { push: false });
              else setActiveSubId(undefined);
            }
          } else {
            mutate(R.deleteMember(config, confirm.subId, confirm.categoryId, confirm.member.id));
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}
