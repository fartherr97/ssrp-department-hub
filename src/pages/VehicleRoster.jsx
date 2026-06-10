import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Car, Tags } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canEditFleet } from "../lib/permissions.js";
import { uid } from "../lib/roster.js";
import {
  Button,
  IconButton,
  Panel,
  PageHeader,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Textarea,
  Select,
  useModalData,
} from "../components/common/index.jsx";

/*
 * Vehicle roster ("fleet") page, which vehicles each rank / unit may use,
 * matching the spreadsheet fleet structures departments already keep:
 * columns of tiers (Recruit … Department Heads, or units like SRT/CIU), each
 * holding vehicle cards (display name + spawn code), with a color-coded
 * legend (e.g. Livery+Lightbar / Slicktop / Ghosted / Unmarked) and a notes
 * box. Page config shape:
 *   { tags: [{id,label,color}], tiers: [{id,name,vehicles:[{id,name,code,tagId}]}], notes }
 * Editing requires the editRoster capability (or manage site).
 */

const DEFAULT_TAGS = [
  { id: "tag-livery", label: "Livery + Lightbar", color: "#e2e8f0" },
  { id: "tag-slicktop", label: "Slicktop", color: "#eab308" },
  { id: "tag-ghosted", label: "Ghosted", color: "#22c55e" },
  { id: "tag-unmarked", label: "Unmarked", color: "#ef4444" },
];

function VehicleModal({ open, onClose, vehicle, tags, onSave }) {
  const [draft, setDraft] = useState(vehicle);
  if (open && draft.id !== vehicle.id) setDraft(vehicle);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vehicle.isNew ? "Add vehicle" : "Edit vehicle"}
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
        <Field label="Vehicle name" hint="e.g. 2021 Charger">
          <Input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Spawn code / callsign" hint="The small code under the name, e.g. HP1E.">
          <Input value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
        </Field>
        <Field label="Tag" hint="Colors the card to match the legend.">
          <Select value={draft.tagId || ""} onChange={(e) => setDraft({ ...draft, tagId: e.target.value })}>
            <option value="">None</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function TagsModal({ open, onClose, tags, onChange }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Legend tags"
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="grid gap-3">
        <p className="text-sm text-slate-400">
          Tags color-code vehicles, e.g. Slicktop, Ghosted, Unmarked. They show as the
          legend at the top of the page.
        </p>
        {tags.map((t) => (
          <div key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <Input
              value={t.label}
              onChange={(e) =>
                onChange(tags.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))
              }
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) =>
                onChange(tags.map((x) => (x.id === t.id ? { ...x, color: e.target.value } : x)))
              }
              className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <IconButton
              icon={Trash2}
              label="Delete tag"
              onClick={() => onChange(tags.filter((x) => x.id !== t.id))}
              className="hover:border-red-500/40 hover:text-red-300"
            />
          </div>
        ))}
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => onChange([...tags, { id: uid("tag"), label: "New tag", color: "#3b82f6" }])}
        >
          Add tag
        </Button>
      </div>
    </Modal>
  );
}

function VehicleCard({ vehicle, tag, canEdit, onEdit, onDelete, onMove, isFirst, isLast }) {
  // Tagged cards get a strong colored outline + tint, like the colored boxes
  // on department fleet sheets (yellow = slicktop, green = ghosted, …).
  const style = tag
    ? {
        borderColor: tag.color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tag.color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tag.color} 7%, var(--color-surface-2))`,
      }
    : undefined;
  return (
    <div
      style={style}
      className="group relative rounded-lg border border-white/15 bg-[var(--color-surface-2)] px-2 py-2 text-center"
      title={tag?.label}
    >
      <div className="text-[13px] font-bold leading-tight text-white">{vehicle.name}</div>
      {vehicle.code && (
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-slate-400">
          {vehicle.code}
        </div>
      )}
      {canEdit && (
        <div className="absolute -right-1.5 -top-1.5 hidden items-center gap-0.5 rounded-lg border border-white/10 bg-[var(--color-surface-1)] p-0.5 shadow-lg group-hover:flex">
          <button onClick={() => onMove(-1)} disabled={isFirst} title="Move up" className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30">
            <ChevronUp size={12} />
          </button>
          <button onClick={() => onMove(1)} disabled={isLast} title="Move down" className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30">
            <ChevronDown size={12} />
          </button>
          <button onClick={onEdit} title="Edit vehicle" className="rounded p-0.5 text-slate-400 hover:text-white">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete} title="Delete vehicle" className="rounded p-0.5 text-slate-400 hover:text-red-300">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function VehicleRoster({ page, user }) {
  const { config, mutate } = useConfig();
  const canEdit = canEditFleet(user, config);
  const cfg = page?.config || {};
  // Defensive: pages converted from other types (or hand-imported configs) may
  // carry a config without fleet fields, never assume the arrays exist.
  const tags = Array.isArray(cfg.tags) && cfg.tags.length ? cfg.tags : DEFAULT_TAGS;
  const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
  const tagById = Object.fromEntries(tags.map((t) => [t.id, t]));

  const [vehicleModal, setVehicleModal] = useState(null); // { tierId, vehicle }
  const [tagsOpen, setTagsOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const vehicleM = useModalData(vehicleModal);

  // All edits patch this page's config object inside the global config.
  const setCfg = (patch) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p
      ),
    }));
  const setTiers = (next) => setCfg({ tiers: next });
  const updateTier = (tierId, patch) =>
    setTiers(tiers.map((t) => (t.id === tierId ? { ...t, ...patch } : t)));

  function moveTier(tierId, dir) {
    const i = tiers.findIndex((t) => t.id === tierId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= tiers.length) return;
    const next = [...tiers];
    [next[i], next[j]] = [next[j], next[i]];
    setTiers(next);
  }
  function moveVehicle(tierId, vehicleId, dir) {
    const tier = tiers.find((t) => t.id === tierId);
    const list = [...(tier?.vehicles || [])];
    const i = list.findIndex((v) => v.id === vehicleId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    updateTier(tierId, { vehicles: list });
  }
  function saveVehicle(draft) {
    const { tierId } = vehicleModal;
    const { isNew, ...clean } = draft;
    const tier = tiers.find((t) => t.id === tierId);
    const list = tier?.vehicles || [];
    updateTier(tierId, {
      vehicles: isNew ? [...list, clean] : list.map((v) => (v.id === clean.id ? clean : v)),
    });
    setVehicleModal(null);
  }

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker || "Fleet"}
        title={cfg.heroTitle || page?.label || "Vehicle Roster"}
        subtitle={cfg.heroSubtitle || "Which vehicles each rank and unit may operate."}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" icon={Tags} onClick={() => setTagsOpen(true)}>
                Legend
              </Button>
              <Button
                icon={Plus}
                onClick={() => setTiers([...tiers, { id: uid("tier"), name: "New Rank / Unit", vehicles: [] }])}
              >
                Add column
              </Button>
            </>
          )
        }
      />

      {/* Legend */}
      {tags.length > 0 && tiers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {canEdit && (
            <span className="w-full text-xs text-slate-500">
              Tags outline a vehicle's card in the legend color, edit a vehicle (pencil) to
              assign one, and use the Legend button to rename or recolor the tags.
            </span>
          )}
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold text-slate-200"
              style={{
                borderColor: `color-mix(in srgb, ${t.color} 55%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${t.color} 10%, transparent)`,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      )}

      {tiers.length === 0 ? (
        <Panel className="p-10 text-center">
          <Car size={32} className="mx-auto mb-3 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No fleet structure yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add a column per rank or unit (Recruit, Trooper… or SRT, CIU), then add the
            vehicles each one may use.
          </p>
          {canEdit && (
            <Button
              icon={Plus}
              className="mt-4"
              onClick={() => setTiers([{ id: uid("tier"), name: "New Rank / Unit", vehicles: [] }])}
            >
              Add the first column
            </Button>
          )}
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-4">
          <div className="flex items-start gap-3">
            {tiers.map((tier, idx) => (
              <div key={tier.id} className="w-40 shrink-0">
                <div className="mb-2 rounded-lg border border-white/15 bg-[color:var(--color-primary)]/12 px-2 py-2 text-center">
                  {canEdit ? (
                    <input
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                      className="w-full bg-transparent text-center text-[13px] font-bold text-white outline-none"
                    />
                  ) : (
                    <div className="text-[13px] font-bold text-white">{tier.name}</div>
                  )}
                </div>
                <div className="grid gap-1.5">
                  {(tier.vehicles || []).map((v, vIdx) => (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      tag={tagById[v.tagId]}
                      canEdit={canEdit}
                      isFirst={vIdx === 0}
                      isLast={vIdx === (tier.vehicles || []).length - 1}
                      onMove={(dir) => moveVehicle(tier.id, v.id, dir)}
                      onEdit={() => setVehicleModal({ tierId: tier.id, vehicle: v })}
                      onDelete={() => setConfirm({ type: "vehicle", tierId: tier.id, vehicle: v })}
                    />
                  ))}
                  {(tier.vehicles || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 px-2 py-3 text-center text-[11px] text-slate-600">
                      No vehicles
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <IconButton
                      icon={ChevronLeft}
                      label="Move column left"
                      disabled={idx === 0}
                      onClick={() => moveTier(tier.id, -1)}
                      className="h-7 w-7 disabled:opacity-30"
                    />
                    <IconButton
                      icon={Plus}
                      label="Add vehicle"
                      onClick={() =>
                        setVehicleModal({
                          tierId: tier.id,
                          vehicle: { id: uid("veh"), name: "", code: "", tagId: "", isNew: true },
                        })
                      }
                      className="h-7 w-7"
                    />
                    <IconButton
                      icon={Trash2}
                      label="Delete column"
                      onClick={() => setConfirm({ type: "tier", tier })}
                      className="h-7 w-7 hover:border-red-500/40 hover:text-red-300"
                    />
                    <IconButton
                      icon={ChevronRight}
                      label="Move column right"
                      disabled={idx === tiers.length - 1}
                      onClick={() => moveTier(tier.id, 1)}
                      className="h-7 w-7 disabled:opacity-30"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Notes */}
      {(cfg.notes || canEdit) && (
        <Panel className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Notes
          </div>
          {canEdit ? (
            <Textarea
              rows={3}
              value={cfg.notes || ""}
              placeholder="e.g. Marked/Ghosted vehicles must display the operator's callsign…"
              onChange={(e) => setCfg({ notes: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{cfg.notes}</p>
          )}
        </Panel>
      )}

      {vehicleM.data && (
        <VehicleModal
          key={vehicleM.key}
          open={vehicleM.open}
          onClose={() => setVehicleModal(null)}
          vehicle={vehicleM.data.vehicle}
          tags={tags}
          onSave={saveVehicle}
        />
      )}
      <TagsModal open={tagsOpen} onClose={() => setTagsOpen(false)} tags={tags} onChange={(next) => setCfg({ tags: next })} />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === "tier" ? "Delete column?" : "Delete vehicle?"}
        message={
          confirm?.type === "tier"
            ? `Delete "${confirm?.tier?.name}" and its ${confirm?.tier?.vehicles?.length || 0} vehicle(s)?`
            : `Delete "${confirm?.vehicle?.name}"?`
        }
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.type === "tier") {
            setTiers(tiers.filter((t) => t.id !== confirm.tier.id));
          } else {
            const tier = tiers.find((t) => t.id === confirm.tierId);
            updateTier(confirm.tierId, {
              vehicles: (tier?.vehicles || []).filter((v) => v.id !== confirm.vehicle.id),
            });
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}
