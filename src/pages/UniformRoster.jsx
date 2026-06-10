import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Shirt } from "lucide-react";
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
  MediaInput,
  useModalData,
} from "../components/common/index.jsx";

/*
 * Uniform roster ("uniforms") page, replacing the uniform class structure
 * sheets departments keep. Each outfit (Class A, Class B, vest options,
 * qualification pins…) is a card: a reference photo next to a table of
 * clothing components (category → number → texture) plus a rules note.
 * Page config shape:
 *   { outfits: [{ id, name, subtitle, imageUrl, note,
 *                 items: [{ id, category, number, texture }] }], notes }
 * Editing requires the editRoster capability (or manage site), same as the
 * vehicle roster.
 */

const STARTER_CATEGORIES = [
  "Masks",
  "Upperbody",
  "Lowerbody",
  "Bags & Parachutes",
  "Shoes",
  "Scarfs & Chains",
  "Shirt & Accessory",
  "Body Armor & Accessory",
  "Badges & Logos",
  "Shirt Overlay & Jackets",
  "Hats & Helmets",
];

function newOutfit() {
  return {
    id: uid("outfit"),
    name: "New Uniform",
    subtitle: "",
    imageUrl: "",
    note: "",
    items: STARTER_CATEGORIES.map((category) => ({
      id: uid("item"),
      category,
      number: "",
      texture: "",
    })),
    isNew: true,
  };
}

// ─── Outfit editor modal ─────────────────────────────────────────────────────

function OutfitModal({ open, onClose, outfit, onSave }) {
  const [draft, setDraft] = useState(outfit);
  const items = draft.items || [];
  const setItems = (next) => setDraft((d) => ({ ...d, items: next }));
  const updateItem = (id, patch) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const moveItem = (id, dir) => {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={outfit.isNew ? "Add uniform" : `Edit “${outfit.name}”`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!draft.name?.trim()} onClick={() => onSave(draft)}>
            Save uniform
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="e.g. Class A Uniform (Male)">
            <Input
              value={draft.name || ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Subtitle" hint="Optional, e.g. Formal events & ceremonies.">
            <Input
              value={draft.subtitle || ""}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Reference photo" hint="A screenshot of the uniform. Paste a link or upload.">
          <MediaInput
            value={draft.imageUrl || ""}
            maxDim={1024}
            onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
              Components
            </span>
            <Button
              variant="secondary"
              icon={Plus}
              className="!py-1.5 text-xs"
              onClick={() =>
                setItems([...items, { id: uid("item"), category: "", number: "", texture: "" }])
              }
            >
              Add row
            </Button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            One row per clothing slot: the category (Upperbody, Hats & Helmets…), the item
            number, and its texture. Leave number blank for slots this uniform doesn't use,
            or delete the row.
          </p>
          <div className="grid gap-1.5">
            {items.map((it, idx) => (
              <div key={it.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_auto] items-center gap-1.5">
                <Input
                  value={it.category || ""}
                  placeholder="Category"
                  onChange={(e) => updateItem(it.id, { category: e.target.value })}
                />
                <Input
                  value={it.number || ""}
                  placeholder="#121, 257"
                  onChange={(e) => updateItem(it.id, { number: e.target.value })}
                  className="font-mono"
                />
                <Input
                  value={it.texture || ""}
                  placeholder="#1 / Rank"
                  onChange={(e) => updateItem(it.id, { texture: e.target.value })}
                  className="font-mono"
                />
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={ChevronUp}
                    label="Move up"
                    disabled={idx === 0}
                    onClick={() => moveItem(it.id, -1)}
                    className="h-8 w-8 disabled:opacity-30"
                  />
                  <IconButton
                    icon={ChevronDown}
                    label="Move down"
                    disabled={idx === items.length - 1}
                    onClick={() => moveItem(it.id, 1)}
                    className="h-8 w-8 disabled:opacity-30"
                  />
                  <IconButton
                    icon={Trash2}
                    label="Remove row"
                    onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                    className="h-8 w-8 hover:border-red-500/40 hover:text-red-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Field label="Note" hint="Optional rules for this uniform, e.g. “May be worn without a tie. Glasses must be professional.”">
          <Textarea
            rows={2}
            value={draft.note || ""}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Outfit card ─────────────────────────────────────────────────────────────

function OutfitCard({ outfit, canEdit, onEdit, onDelete, onMove, isFirst, isLast }) {
  const items = (outfit.items || []).filter((it) => it.category || it.number || it.texture);
  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">{outfit.name}</div>
          {outfit.subtitle && (
            <div className="truncate text-[11px] uppercase tracking-wide text-slate-500">
              {outfit.subtitle}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton icon={ChevronUp} label="Move up" disabled={isFirst} onClick={() => onMove(-1)} className="h-7 w-7 disabled:opacity-30" />
            <IconButton icon={ChevronDown} label="Move down" disabled={isLast} onClick={() => onMove(1)} className="h-7 w-7 disabled:opacity-30" />
            <IconButton icon={Pencil} label="Edit uniform" onClick={onEdit} className="h-7 w-7" />
            <IconButton icon={Trash2} label="Delete uniform" onClick={onDelete} className="h-7 w-7 hover:border-red-500/40 hover:text-red-300" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col sm:flex-row">
        {outfit.imageUrl && (
          <img
            src={outfit.imageUrl}
            alt={outfit.name}
            className="h-48 w-full border-b border-white/10 object-cover object-top sm:h-auto sm:max-h-none sm:w-40 sm:border-b-0 sm:border-r"
          />
        )}
        <div className="min-w-0 flex-1 p-3">
          {items.length === 0 ? (
            <p className="px-1 py-2 text-sm text-slate-500">
              No components listed yet{canEdit ? ", use the pencil to add them." : "."}
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-1 font-semibold">Component</th>
                  <th className="px-2 py-1 text-right font-semibold">#</th>
                  <th className="px-2 py-1 text-right font-semibold">Texture</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-white/5">
                    <td className="px-2 py-1.5 text-[13px] font-medium text-slate-300">
                      {it.category || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[13px] font-semibold text-white">
                      {it.number || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[12px] text-[var(--color-primary)]">
                      {it.texture || <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {outfit.note && (
            <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-1.5 text-xs leading-5 text-amber-200/90">
              {outfit.note}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UniformRoster({ page, user }) {
  const { config, mutate } = useConfig();
  const canEdit = canEditFleet(user, config);
  const cfg = page?.config || {};
  const outfits = Array.isArray(cfg.outfits) ? cfg.outfits : [];

  const [outfitModal, setOutfitModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const outfitM = useModalData(outfitModal);

  const setCfg = (patch) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p
      ),
    }));
  const setOutfits = (next) => setCfg({ outfits: next });

  function moveOutfit(id, dir) {
    const i = outfits.findIndex((o) => o.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= outfits.length) return;
    const next = [...outfits];
    [next[i], next[j]] = [next[j], next[i]];
    setOutfits(next);
  }
  function saveOutfit(draft) {
    const { isNew, ...clean } = draft;
    setOutfits(
      isNew ? [...outfits, clean] : outfits.map((o) => (o.id === clean.id ? clean : o))
    );
    setOutfitModal(null);
  }

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker || "Personnel"}
        title={cfg.heroTitle || page?.label || "Uniform Roster"}
        subtitle={cfg.heroSubtitle || "Approved uniforms and their components, numbers, and textures."}
        actions={
          canEdit && (
            <Button icon={Plus} onClick={() => setOutfitModal(newOutfit())}>
              Add uniform
            </Button>
          )
        }
      />

      {outfits.length === 0 ? (
        <Panel className="p-10 text-center">
          <Shirt size={32} className="mx-auto mb-3 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No uniforms yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add a card per uniform (Class A, Class B, vest options, qualification pins…),
            each with a reference photo and its component numbers and textures.
          </p>
          {canEdit && (
            <Button icon={Plus} className="mt-4" onClick={() => setOutfitModal(newOutfit())}>
              Add the first uniform
            </Button>
          )}
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {outfits.map((o, idx) => (
            <OutfitCard
              key={o.id}
              outfit={o}
              canEdit={canEdit}
              isFirst={idx === 0}
              isLast={idx === outfits.length - 1}
              onMove={(dir) => moveOutfit(o.id, dir)}
              onEdit={() => setOutfitModal(o)}
              onDelete={() => setConfirm(o)}
            />
          ))}
        </div>
      )}

      {/* Page-level rules */}
      {(cfg.notes || canEdit) && (
        <Panel className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Department uniform rules
          </div>
          {canEdit ? (
            <Textarea
              rows={3}
              value={cfg.notes || ""}
              placeholder="e.g. Hats are mandatory on duty. Glasses must be professional…"
              onChange={(e) => setCfg({ notes: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{cfg.notes}</p>
          )}
        </Panel>
      )}

      {outfitM.data && (
        <OutfitModal
          key={outfitM.key}
          open={outfitM.open}
          onClose={() => setOutfitModal(null)}
          outfit={outfitM.data}
          onSave={saveOutfit}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete uniform?"
        message={`Delete "${confirm?.name}" and its component list?`}
        confirmLabel="Delete uniform"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setOutfits(outfits.filter((o) => o.id !== confirm.id));
          setConfirm(null);
        }}
      />
    </div>
  );
}
