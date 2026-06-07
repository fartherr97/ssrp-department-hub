import { useState } from "react";
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

        {fields.map((f) => (
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
        ))}

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

// ─── Member row ──────────────────────────────────────────────────────────────

function MemberRow({ member, rank, fields, canEdit, onEdit, onDelete, onDragStart }) {
  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart(e, rank.id, member.id)}
      className="group flex items-center gap-3 rounded-xl border border-white/5 bg-[var(--color-surface-2)]/60 px-3 py-2.5 transition hover:border-white/10"
    >
      {canEdit && (
        <GripVertical
          size={15}
          className="shrink-0 cursor-grab text-slate-600 group-hover:text-slate-400"
        />
      )}
      <MemberAvatar member={member} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{member.name}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
          {fields.map((f) => {
            const val = member.fields?.[f.id];
            if (!val) return null;
            return (
              <span key={f.id}>
                <span className="text-slate-500">{f.label}:</span> {val}
              </span>
            );
          })}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <IconButton icon={Pencil} label="Edit member" onClick={() => onEdit(rank.id, member)} />
          <IconButton
            icon={Trash2}
            label="Remove member"
            onClick={() => onDelete(rank.id, member)}
            className="hover:border-red-500/40 hover:text-red-300"
          />
        </div>
      )}
    </div>
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
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/14 text-white"
                  : "border border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {s.name}
              <span
                className={`rounded-full px-1.5 text-[11px] font-bold ${
                  isActive ? "bg-[color:var(--color-primary)]/30 text-white" : "bg-white/10 text-slate-400"
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Roster({ user }) {
  const { config, mutate } = useConfig();
  const canEdit = canEditRoster(user, config);
  const fields = config.roster.memberFields || [];
  const subdivisions = config.roster.subdivisions || [];

  const [activeSubId, setActiveSubId] = useState(subdivisions[0]?.id);
  // Active subdivision (fall back to first if the current one was deleted).
  const activeSub = subdivisions.find((s) => s.id === activeSubId) || subdivisions[0];
  const subId = activeSub?.id;
  const ranks = activeSub?.ranks || [];
  const totalMembers = ranks.reduce((n, r) => n + r.members.length, 0);

  const [memberModal, setMemberModal] = useState(null); // { rankId, member }
  const [rankModal, setRankModal] = useState(null); // rank
  const [subModal, setSubModal] = useState(null); // subdivision
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { type, ... }
  const [dragOverRank, setDragOverRank] = useState(null);

  // ── Member handlers ──
  function openNewMember(rankId) {
    setMemberModal({ rankId, member: { id: R.uid("member"), name: "", fields: {}, isNew: true } });
  }
  function openEditMember(rankId, member) {
    setMemberModal({ rankId, member });
  }
  function saveMember(draft, targetRank) {
    const { rankId } = memberModal;
    const { isNew, ...clean } = draft;
    mutate((cfg) => {
      if (isNew) return R.addMember(cfg, subId, rankId, clean);
      let next = R.updateMember(cfg, subId, rankId, clean.id, clean);
      if (targetRank && targetRank !== rankId) {
        next = R.moveMember(next, subId, rankId, clean.id, targetRank);
      }
      return next;
    });
    setMemberModal(null);
  }

  // ── Rank handlers ──
  function saveRank(draft) {
    const { isNew, ...clean } = draft;
    mutate((cfg) =>
      isNew
        ? R.addRank(cfg, subId, { name: clean.name, color: clean.color })
        : R.updateRank(cfg, subId, clean.id, { name: clean.name, color: clean.color })
    );
    setRankModal(null);
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

  // ── Drag and drop (within the active subdivision) ──
  function onDragStart(e, fromRankId, memberId) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ fromRankId, memberId }));
  }
  function onDrop(e, toRankId) {
    e.preventDefault();
    setDragOverRank(null);
    try {
      const { fromRankId, memberId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (fromRankId !== toRankId) {
        mutate((cfg) => R.moveMember(cfg, subId, fromRankId, memberId, toRankId));
      }
    } catch {
      /* ignore malformed drop */
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Personnel"
        title="Roster"
        subtitle={
          activeSub
            ? `${activeSub.name} · ${totalMembers} member${totalMembers === 1 ? "" : "s"} across ${ranks.length} rank${ranks.length === 1 ? "" : "s"}.`
            : "No subdivisions yet."
        }
        actions={
          canEdit && (
            <>
              <Button variant="secondary" icon={Columns3} onClick={() => setColumnsOpen(true)}>
                Columns
              </Button>
              <Button
                icon={Plus}
                onClick={() => setRankModal({ id: R.uid("rank"), name: "", color: "#3b82f6", isNew: true })}
              >
                Add rank
              </Button>
            </>
          )
        }
      />

      <SubdivisionTabs
        subdivisions={subdivisions}
        activeId={subId}
        canEdit={canEdit}
        onSelect={setActiveSubId}
        onAdd={() => setSubModal({ id: R.uid("sub"), name: "", isNew: true })}
        onRename={(sub) => setSubModal(sub)}
        onMove={(id, dir) => mutate(R.moveSubdivision(config, id, dir))}
        onDelete={(sub) => setConfirm({ type: "subdivision", subdivision: sub })}
      />

      {ranks.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No ranks yet"
          subtitle={`Add your first rank to start building the ${activeSub?.name || "roster"}.`}
          action={
            canEdit && (
              <Button
                icon={Plus}
                onClick={() => setRankModal({ id: R.uid("rank"), name: "", color: "#3b82f6", isNew: true })}
              >
                Add rank
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {ranks.map((rank, idx) => (
            <Panel
              key={rank.id}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverRank(rank.id);
              }}
              onDragLeave={() => setDragOverRank((c) => (c === rank.id ? null : c))}
              onDrop={(e) => canEdit && onDrop(e, rank.id)}
              className={`overflow-hidden transition ${
                dragOverRank === rank.id ? "ring-2 ring-[color:var(--color-primary)]/60" : ""
              }`}
            >
              <div
                className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
                style={{ borderLeft: `3px solid ${rank.color || "#3b82f6"}` }}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: rank.color || "#3b82f6" }}
                />
                <h2 className="text-base font-bold text-white">{rank.name}</h2>
                <Badge color={rank.color}>{rank.members.length}</Badge>
                <div className="ml-auto flex items-center gap-1">
                  {canEdit && (
                    <>
                      <IconButton
                        icon={ChevronUp}
                        label="Move rank up"
                        disabled={idx === 0}
                        onClick={() => mutate(R.moveRank(config, subId, rank.id, -1))}
                        className="disabled:opacity-30"
                      />
                      <IconButton
                        icon={ChevronDown}
                        label="Move rank down"
                        disabled={idx === ranks.length - 1}
                        onClick={() => mutate(R.moveRank(config, subId, rank.id, 1))}
                        className="disabled:opacity-30"
                      />
                      <IconButton icon={UserPlus} label="Add member" onClick={() => openNewMember(rank.id)} />
                      <IconButton icon={Pencil} label="Edit rank" onClick={() => setRankModal(rank)} />
                      <IconButton
                        icon={Trash2}
                        label="Delete rank"
                        onClick={() => setConfirm({ type: "rank", rank })}
                        className="hover:border-red-500/40 hover:text-red-300"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-2 p-3">
                {rank.members.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-500">
                    No members{canEdit ? " — add one or drag a member here." : "."}
                  </p>
                ) : (
                  rank.members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      rank={rank}
                      fields={fields}
                      canEdit={canEdit}
                      onEdit={openEditMember}
                      onDelete={(rankId, m) => setConfirm({ type: "member", rankId, member: m })}
                      onDragStart={onDragStart}
                    />
                  ))
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* Modals */}
      {memberModal && (
        <MemberModal
          open
          onClose={() => setMemberModal(null)}
          fields={fields}
          ranks={ranks}
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
          if (confirm.type === "rank") mutate(R.deleteRank(config, subId, confirm.rank.id));
          else if (confirm.type === "subdivision") {
            mutate(R.deleteSubdivision(config, confirm.subdivision.id));
            if (confirm.subdivision.id === activeSubId) {
              const fallback = subdivisions.find((s) => s.id !== confirm.subdivision.id);
              setActiveSubId(fallback?.id);
            }
          } else mutate(R.deleteMember(config, subId, confirm.rankId, confirm.member.id));
          setConfirm(null);
        }}
      />
    </div>
  );
}
