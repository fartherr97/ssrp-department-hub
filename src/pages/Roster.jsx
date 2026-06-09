import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { isAdmin, groupLevel } from "../lib/permissions.js";
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
} from "../components/common/index.jsx";
import * as R from "../lib/roster.js";

function canEditRoster(user, config) {
  if (isAdmin(user)) return true;
  // Command-level and above may edit the roster by default.
  return groupLevel(config, user?.group) >= groupLevel(config, "command");
}

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

// Renders one member field cell by type: checkbox (✓), cert (CERTIFIED/N/A),
// colored status pill, or plain text.
function FieldValue({ field, value, statusFieldId, accent }) {
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

function computeStat(item, ranks, statusField) {
  if (item.mode === "manual") return item.value || "—";
  let count = 0;
  for (const r of ranks) {
    for (const m of r.members) {
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

function StatsPanel({ stats, ranks, statusField, accent }) {
  if (!stats?.show || !stats.items?.length) return null;
  return (
    <Panel className="mb-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-cad-muted">
              {item.label}
            </div>
            <div
              className="mt-0.5 text-2xl font-black tabular-nums"
              style={{ color: item.color || accent }}
            >
              {computeStat(item, ranks, statusField)}
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

// ─── Member edit modal ───────────────────────────────────────────────────────

function MemberModal({ open, onClose, fields, ranks, rankId, member, onSave }) {
  const [draft, setDraft] = useState(member);
  const [targetRank, setTargetRank] = useState(rankId);

  if (open && draft.id !== member.id) {
    setDraft(member);
    setTargetRank(rankId);
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
          <Button onClick={() => onSave(draft, targetRank)}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name">
          <Input
            value={draft.name || ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Member name"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discord ID" hint="Used by the backend to match Discord roles.">
            <Input
              value={draft.discordId || ""}
              onChange={(e) => setDraft({ ...draft, discordId: e.target.value })}
              placeholder="000000000000000000"
            />
          </Field>
          <Field label="Avatar URL">
            <Input
              value={draft.avatarUrl || ""}
              onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        </div>

        {fields.map((f) => {
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

        <Field label="Rank" hint="Move this member to a different rank.">
          <Select value={targetRank} onChange={(e) => setTargetRank(e.target.value)}>
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

// ─── Rank edit modal ─────────────────────────────────────────────────────────

function RankModal({ open, onClose, rank, onSave }) {
  const [draft, setDraft] = useState(rank);
  if (open && draft.id !== rank.id) setDraft(rank);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rank.isNew ? "Add rank" : "Edit rank"}
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
        <Field label="Rank name">
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
        <Field label="Insignia image URL" hint="Optional icon shown on the rank header.">
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
                <Field label="Options (comma separated)">
                  <Input
                    value={(f.options || []).join(", ")}
                    onChange={(e) =>
                      mutate(
                        R.updateMemberField(config, f.id, {
                          options: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      )
                    }
                  />
                </Field>
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
          const count = s.ranks.reduce((n, r) => n + r.members.length, 0);
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

function MemberRow({ member, rank, fields, statusFieldId, accent, colCount, canEdit, onEdit, onDelete, onDragStart }) {
  return (
    <tr
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e, rank.id, member.id)}
      className="group border-t border-white/5 transition hover:bg-white/[0.03]"
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          {canEdit && (
            <GripVertical
              size={14}
              className="shrink-0 cursor-grab text-slate-600 group-hover:text-slate-400"
            />
          )}
          <MemberAvatar member={member} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{member.name}</div>
            {member.discordId && (
              <div className="truncate font-mono text-[11px] text-slate-500">{member.discordId}</div>
            )}
          </div>
        </div>
      </td>
      {fields.map((f) => (
        <td key={f.id} className="px-3 py-2.5 align-middle text-sm">
          <FieldValue
            field={f}
            value={member.fields?.[f.id]}
            statusFieldId={statusFieldId}
            accent={accent}
          />
        </td>
      ))}
      {canEdit && (
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
            <IconButton icon={Pencil} label="Edit member" onClick={() => onEdit(rank.id, member)} />
            <IconButton
              icon={Trash2}
              label="Remove member"
              onClick={() => onDelete(rank.id, member)}
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
  rankFilter = "all",
  matches,
  filtering,
  dragOverRank,
  setDragOverRank,
  onDragStart,
  onDrop,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onMoveRank,
  onEditRank,
  onDeleteRank,
  compact = false,
}) {
  const ranks = sub.ranks || [];
  const colCount = 1 + fields.length + (canEdit ? 1 : 0);
  const visibleRanks = ranks.filter((r) => rankFilter === "all" || r.id === rankFilter);

  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full border-collapse text-left ${compact ? "min-w-[460px]" : "min-w-[720px]"}`}
      >
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5 font-semibold">Name</th>
            {fields.map((f) => (
              <th key={f.id} className="px-3 py-2.5 font-semibold">
                {f.label}
              </th>
            ))}
            {canEdit && <th className="px-3 py-2.5" />}
          </tr>
        </thead>
        {visibleRanks.map((rank) => {
          const members = rank.members.filter(matches);
          if (filtering && members.length === 0) return null;
          return (
            <tbody
              key={rank.id}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverRank(rank.id);
              }}
              onDragLeave={() => setDragOverRank((c) => (c === rank.id ? null : c))}
              onDrop={(e) => canEdit && onDrop(e, sub.id, rank.id)}
              className={dragOverRank === rank.id ? "bg-[color:var(--color-primary)]/5" : ""}
            >
              {/* Colored rank/team header row */}
              <tr>
                <td
                  colSpan={colCount}
                  className="border-t border-white/10 px-3 py-2"
                  style={{
                    background: `linear-gradient(90deg, ${rank.color}1f 0%, transparent 60%)`,
                    borderLeft: `3px solid ${rank.color || "#3b82f6"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {rank.insigniaUrl && (
                      <img src={rank.insigniaUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
                    )}
                    <span
                      className="text-xs font-black uppercase tracking-[0.15em]"
                      style={{ color: rank.color || "#3b82f6" }}
                    >
                      {rank.name}
                    </span>
                    <Badge color={rank.color}>{rank.members.length}</Badge>
                    {canEdit && (
                      <div className="ml-auto flex items-center gap-1">
                        <IconButton
                          icon={ChevronUp}
                          label="Move rank up"
                          disabled={ranks.indexOf(rank) === 0}
                          onClick={() => onMoveRank(sub.id, rank.id, -1)}
                          className="h-7 w-7 disabled:opacity-30"
                        />
                        <IconButton
                          icon={ChevronDown}
                          label="Move rank down"
                          disabled={ranks.indexOf(rank) === ranks.length - 1}
                          onClick={() => onMoveRank(sub.id, rank.id, 1)}
                          className="h-7 w-7 disabled:opacity-30"
                        />
                        <IconButton
                          icon={UserPlus}
                          label="Add member"
                          onClick={() => onAddMember(sub.id, rank.id)}
                          className="h-7 w-7"
                        />
                        <IconButton
                          icon={Pencil}
                          label="Edit rank"
                          onClick={() => onEditRank(sub.id, rank)}
                          className="h-7 w-7"
                        />
                        <IconButton
                          icon={Trash2}
                          label="Delete rank"
                          onClick={() => onDeleteRank(sub.id, rank)}
                          className="h-7 w-7 hover:border-red-500/40 hover:text-red-300"
                        />
                      </div>
                    )}
                  </div>
                </td>
              </tr>

              {members.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-3 text-sm text-slate-500">
                    No members{canEdit ? " — add one or drag a member here." : "."}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    rank={rank}
                    fields={fields}
                    statusFieldId={statusField?.id}
                    accent={accent}
                    canEdit={canEdit}
                    onEdit={(rankId, m) => onEditMember(sub.id, rankId, m)}
                    onDelete={(rankId, m) => onDeleteMember(sub.id, rankId, m)}
                    onDragStart={onDragStart}
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

export default function Roster({ user }) {
  const { config, mutate } = useConfig();
  const canEdit = canEditRoster(user, config);
  const fields = config.roster.memberFields || [];
  const subdivisions = config.roster.subdivisions || [];
  const statusField = findStatusField(fields);

  const [activeSubId, setActiveSubId] = useState(subdivisions[0]?.id);
  const activeSub = subdivisions.find((s) => s.id === activeSubId) || subdivisions[0];
  const subId = activeSub?.id;
  const ranks = activeSub?.ranks || [];
  const totalMembers = ranks.reduce((n, r) => n + r.members.length, 0);
  const accent = activeSub?.accent || "var(--color-primary)";
  const stats = config.roster.stats;
  const statsShown = Boolean(stats?.show && stats.items?.length);

  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [memberModal, setMemberModal] = useState(null);
  const [rankModal, setRankModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [dragOverRank, setDragOverRank] = useState(null);

  // Status counts for the summary pills (across the whole active subdivision).
  const statusCounts = useMemo(() => {
    const counts = {};
    if (statusField) {
      for (const rank of ranks) {
        for (const m of rank.members) {
          const v = m.fields?.[statusField.id];
          if (v) counts[v] = (counts[v] || 0) + 1;
        }
      }
    }
    return counts;
  }, [ranks, statusField]);

  const q = query.trim().toLowerCase();
  function matches(member) {
    if (!q) return true;
    const hay = [member.name, member.discordId, ...Object.values(member.fields || {})]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  }
  const filtering = q !== "" || rankFilter !== "all";

  // Layout: "tabs" (one subdivision at a time) or "grid" (all side-by-side).
  const layout = config.roster.layout === "grid" ? "grid" : "tabs";
  const allRanks = useMemo(
    () => subdivisions.flatMap((s) => s.ranks || []),
    [subdivisions]
  );
  const statsRanks = layout === "grid" ? allRanks : ranks;

  // ── Member handlers (subdivision-agnostic; the active/card sub is passed in) ──
  function openNewMember(forSubId, rankId) {
    setMemberModal({
      subId: forSubId,
      rankId,
      member: { id: R.uid("member"), name: "", fields: {}, isNew: true },
    });
  }
  function openEditMember(forSubId, rankId, member) {
    setMemberModal({ subId: forSubId, rankId, member });
  }
  function saveMember(draft, targetRank) {
    const { subId: mSubId, rankId } = memberModal;
    const { isNew, ...clean } = draft;
    mutate((cfg) => {
      if (isNew) return R.addMember(cfg, mSubId, rankId, clean);
      let next = R.updateMember(cfg, mSubId, rankId, clean.id, clean);
      if (targetRank && targetRank !== rankId) {
        next = R.moveMember(next, mSubId, rankId, clean.id, targetRank);
      }
      return next;
    });
    setMemberModal(null);
  }

  // ── Rank handlers ──
  function openAddRank(forSubId) {
    setRankModal({ id: R.uid("rank"), name: "", color: "#3b82f6", isNew: true, subId: forSubId });
  }
  function openEditRank(forSubId, rank) {
    setRankModal({ ...rank, subId: forSubId });
  }
  function saveRank(draft) {
    const targetSub = rankModal.subId;
    const { isNew, ...clean } = draft;
    const patch = { name: clean.name, color: clean.color, insigniaUrl: clean.insigniaUrl || "" };
    mutate((cfg) =>
      isNew ? R.addRank(cfg, targetSub, patch) : R.updateRank(cfg, targetSub, clean.id, patch)
    );
    setRankModal(null);
  }
  function moveRank(forSubId, rankId, dir) {
    mutate(R.moveRank(config, forSubId, rankId, dir));
  }
  function confirmDeleteRank(forSubId, rank) {
    setConfirm({ type: "rank", subId: forSubId, rank });
  }
  function confirmDeleteMember(forSubId, rankId, member) {
    setConfirm({ type: "member", subId: forSubId, rankId, member });
  }

  // ── Subdivision handlers ──
  function saveSubdivision(name) {
    const sub = subModal;
    if (sub.isNew) {
      const newId = R.uid("sub");
      mutate((cfg) => R.addSubdivision(cfg, { id: newId, name: name || "New Subdivision" }));
      setActiveSubId(newId);
    } else {
      mutate(R.updateSubdivision(config, sub.id, { name }));
    }
    setSubModal(null);
  }

  // ── Drag and drop (within a subdivision) ──
  function onDragStart(e, fromRankId, memberId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ fromRankId, memberId }));
  }
  function onDrop(e, toSubId, toRankId) {
    e.preventDefault();
    setDragOverRank(null);
    try {
      const { fromRankId, memberId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (fromRankId !== toRankId) {
        mutate((cfg) => R.moveMember(cfg, toSubId, fromRankId, memberId, toRankId));
      }
    } catch {
      /* ignore malformed drop */
    }
  }

  // Shared SubRoster wiring (same handlers for both layouts).
  const subRosterProps = {
    fields,
    statusField,
    canEdit,
    matches,
    filtering,
    dragOverRank,
    setDragOverRank,
    onDragStart,
    onDrop,
    onAddMember: openNewMember,
    onEditMember: openEditMember,
    onDeleteMember: confirmDeleteMember,
    onMoveRank: moveRank,
    onEditRank: openEditRank,
    onDeleteRank: confirmDeleteRank,
  };

  const modalSub = memberModal
    ? subdivisions.find((s) => s.id === memberModal.subId)
    : null;

  return (
    <div>
      <PageHeader
        kicker="Personnel"
        title="Roster"
        subtitle={
          layout === "grid"
            ? `${subdivisions.length} subdivision${subdivisions.length === 1 ? "" : "s"} · ${allRanks.reduce(
                (n, r) => n + r.members.length,
                0
              )} members`
            : activeSub
            ? `${activeSub.name} · ${totalMembers} member${totalMembers === 1 ? "" : "s"}`
            : "No subdivisions yet."
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" icon={Columns3} onClick={() => setColumnsOpen(true)}>
                Columns
              </Button>
              {layout === "tabs" && subId && (
                <Button icon={Plus} onClick={() => openAddRank(subId)}>
                  Add rank
                </Button>
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
            canEdit={canEdit}
            onSelect={(id) => {
              setActiveSubId(id);
              setRankFilter("all");
            }}
            onAdd={() => setSubModal({ id: R.uid("sub"), name: "", isNew: true })}
            onRename={(sub) => setSubModal(sub)}
            onMove={(id, dir) => mutate(R.moveSubdivision(config, id, dir))}
            onDelete={(sub) => setConfirm({ type: "subdivision", subdivision: sub })}
          />

          <RosterBanner sub={activeSub} accent={accent} />
          <StatsPanel stats={stats} ranks={ranks} statusField={statusField} accent={accent} />

          {/* Summary + controls */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {statsShown ? (
              <div />
            ) : (
              <StatPills total={totalMembers} statusField={statusField} counts={statusCounts} />
            )}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID, field…"
                  className="w-56 pl-9"
                />
              </div>
              <Select value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} className="w-40">
                <option value="all">All ranks</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {ranks.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No ranks yet"
              subtitle={`Add your first rank to start building the ${activeSub?.name || "roster"}.`}
              action={
                canEdit && (
                  <Button icon={Plus} onClick={() => openAddRank(subId)}>
                    Add rank
                  </Button>
                )
              }
            />
          ) : (
            <Panel className="overflow-hidden">
              <SubRoster
                sub={activeSub}
                accent={accent}
                rankFilter={rankFilter}
                {...subRosterProps}
              />
            </Panel>
          )}
        </>
      ) : (
        <>
          {/* Grid layout — every subdivision side-by-side */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {canEdit && (
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
            stats={stats}
            ranks={allRanks}
            statusField={statusField}
            accent="var(--color-primary)"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {subdivisions.map((s) => {
              const sAccent = s.accent || "var(--color-primary)";
              const sRanks = s.ranks || [];
              const count = sRanks.reduce((n, r) => n + r.members.length, 0);
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
                    {canEdit && (
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <IconButton
                          icon={Plus}
                          label="Add rank"
                          onClick={() => openAddRank(s.id)}
                          className="h-7 w-7"
                        />
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
                      </div>
                    )}
                  </div>

                  {sRanks.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-500">
                      No ranks yet{canEdit ? " — use + to add one." : "."}
                    </div>
                  ) : (
                    <SubRoster sub={s} accent={sAccent} compact {...subRosterProps} />
                  )}
                </Panel>
              );
            })}
          </div>
        </>
      )}

      {/* Modals (shared by both layouts) */}
      {memberModal && (
        <MemberModal
          open
          onClose={() => setMemberModal(null)}
          fields={fields}
          ranks={modalSub?.ranks || ranks}
          rankId={memberModal.rankId}
          member={memberModal.member}
          onSave={saveMember}
        />
      )}
      {rankModal && (
        <RankModal open onClose={() => setRankModal(null)} rank={rankModal} onSave={saveRank} />
      )}
      {subModal && (
        <SubdivisionModal
          key={subModal.id}
          open
          onClose={() => setSubModal(null)}
          subdivision={subModal}
          onSave={saveSubdivision}
        />
      )}
      <ColumnsModal open={columnsOpen} onClose={() => setColumnsOpen(false)} />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.type === "rank"
            ? "Delete rank?"
            : confirm?.type === "subdivision"
            ? "Delete subdivision?"
            : "Remove member?"
        }
        message={
          confirm?.type === "rank"
            ? `Delete "${confirm?.rank?.name}" and all ${confirm?.rank?.members?.length || 0} member(s) in it? This can't be undone.`
            : confirm?.type === "subdivision"
            ? `Delete the "${confirm?.subdivision?.name}" subdivision and its entire roster? This can't be undone.`
            : `Remove "${confirm?.member?.name}" from the roster?`
        }
        confirmLabel={
          confirm?.type === "rank"
            ? "Delete rank"
            : confirm?.type === "subdivision"
            ? "Delete subdivision"
            : "Remove"
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.type === "rank") mutate(R.deleteRank(config, confirm.subId, confirm.rank.id));
          else if (confirm.type === "subdivision") {
            mutate(R.deleteSubdivision(config, confirm.subdivision.id));
            if (confirm.subdivision.id === activeSubId) {
              const fallback = subdivisions.find((s) => s.id !== confirm.subdivision.id);
              setActiveSubId(fallback?.id);
            }
          } else mutate(R.deleteMember(config, confirm.subId, confirm.rankId, confirm.member.id));
          setConfirm(null);
        }}
      />
    </div>
  );
}
