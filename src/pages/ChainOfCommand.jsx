import { useState } from "react";
import { Plus, ArrowUp, Network } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canEditFleet } from "../lib/permissions.js";
import { uid } from "../lib/roster.js";
import {
  Button,
  Panel,
  PageHeader,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Textarea,
  ColorInput,
  useModalData,
} from "../components/common/index.jsx";

/*
 * Chain of Command page ("chain"), replacing the org-chart sheets departments
 * keep. The chart is a tree of boxes, each with a position title, the
 * holder's name, an optional color, and an optional member list rendered as a
 * column underneath (the Cpl/Officer rosters at the bottom of the sheets).
 * Page config shape:
 *   { root: { id, title, name, color, members: [string], children: [node] },
 *     notes }
 * Editing requires the editRoster capability (or manage site). Click any box
 * to edit it, add boxes below it, reorder it among its siblings, or delete it
 * with everything under it.
 */

function newNode(title = "New Position") {
  return { id: uid("node"), title, name: "", color: "", members: [], children: [] };
}

// ── Pure tree helpers (immutable, by node id) ────────────────────────────────

function mapTree(node, fn) {
  if (!node) return node;
  const next = fn(node);
  return { ...next, children: (next.children || []).map((c) => mapTree(c, fn)) };
}

function updateNode(root, id, patch) {
  return mapTree(root, (n) => (n.id === id ? { ...n, ...patch } : n));
}

function addChild(root, id, child) {
  return mapTree(root, (n) =>
    n.id === id ? { ...n, children: [...(n.children || []), child] } : n
  );
}

function deleteNode(root, id) {
  if (!root || root.id === id) return null;
  const prune = (n) => ({
    ...n,
    children: (n.children || []).filter((c) => c.id !== id).map(prune),
  });
  return prune(root);
}

function moveNode(root, id, dir) {
  return mapTree(root, (n) => {
    const kids = n.children || [];
    const i = kids.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= kids.length) return n;
    const next = [...kids];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...n, children: next };
  });
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + countNodes(c), 0);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function NodeCard({ node, accent, canEdit, onEdit }) {
  const color = node.color || accent;
  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => onEdit(node)}
      title={canEdit ? "Edit this box" : undefined}
      style={{
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, var(--color-surface-2))`,
      }}
      className={`w-44 rounded-lg border px-2 py-1.5 text-center ${
        canEdit ? "press cursor-pointer hover:brightness-125" : "cursor-default"
      }`}
    >
      <div
        className="truncate text-[11px] font-bold uppercase tracking-wide"
        style={{ color }}
        title={node.title}
      >
        {node.title || "Untitled"}
      </div>
      {node.name && (
        <div className="truncate text-[13px] font-bold text-white" title={node.name}>
          {node.name}
        </div>
      )}
    </button>
  );
}

function MemberColumn({ node, accent }) {
  const members = (node.members || []).filter(Boolean);
  if (!members.length) return null;
  const color = node.color || accent;
  return (
    <div className="mt-1.5 grid w-44 gap-1">
      {members.map((m, i) => (
        <div
          key={i}
          style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
          className="truncate rounded-md border bg-white/[0.03] px-2 py-1 text-center text-xs text-slate-300"
          title={m}
        >
          {m}
        </div>
      ))}
    </div>
  );
}

function NodeTree({ node, accent, canEdit, onEdit, onAddChild }) {
  const children = node.children || [];
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} accent={accent} canEdit={canEdit} onEdit={onEdit} />
      <MemberColumn node={node} accent={accent} />
      {(children.length > 0 || canEdit) && (
        <div className="mt-1 flex items-start gap-3">
          {children.map((child) => (
            <div key={child.id} className="flex flex-col items-center">
              <ArrowUp size={13} className="my-1 shrink-0 text-slate-500" />
              <NodeTree
                node={child}
                accent={accent}
                canEdit={canEdit}
                onEdit={onEdit}
                onAddChild={onAddChild}
              />
            </div>
          ))}
          {canEdit && (
            // A dashed slot under every box, so growing the chart is one
            // obvious click instead of digging through the edit modal.
            <div className="flex flex-col items-center">
              <div className="my-1 h-[13px]" />
              <button
                type="button"
                onClick={() => onAddChild(node.id)}
                title={`Add a box under “${node.title}”`}
                className="press flex h-[46px] w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 text-xs font-semibold text-slate-500 transition hover:border-[color:var(--color-border-strong)] hover:text-[var(--color-primary)]"
              >
                <Plus size={13} />
                Add box
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Box editor modal ─────────────────────────────────────────────────────────

function NodeModal({ open, onClose, node, isRoot, onSave, onAddChild, onMove, onDelete }) {
  const [draft, setDraft] = useState(node);
  const membersText = (draft.members || []).join("\n");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit “${node.title || "box"}”`}
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            Delete box
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!draft.title?.trim()} onClick={() => onSave(draft)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Position title" hint="e.g. Patrol Lieutenant">
            <Input
              value={draft.title || ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Name(s)" hint="Who holds it, e.g. J. Welch. Blank = vacant.">
            <Input
              value={draft.name || ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Box color" hint="Blank uses the page accent.">
          <ColorInput value={draft.color || ""} onChange={(color) => setDraft({ ...draft, color })} />
        </Field>
        <Field
          label="Member list"
          hint="Optional, one per line. Shows as a column under the box, like the Cpl/Officer lists at the bottom of the chart."
        >
          <Textarea
            rows={4}
            value={membersText}
            placeholder={"Cpl. D. Smith\nN. Brown\nJ. Carter"}
            onChange={(e) => setDraft({ ...draft, members: e.target.value.split("\n") })}
          />
        </Field>

        <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-3">
          <Button variant="secondary" icon={Plus} onClick={() => onAddChild(draft)}>
            Add box below
          </Button>
          <Button variant="secondary" disabled={isRoot} onClick={() => onMove(-1)}>
            ← Move left
          </Button>
          <Button variant="secondary" disabled={isRoot} onClick={() => onMove(1)}>
            Move right →
          </Button>
          <p className="text-xs text-slate-500 sm:col-span-3">
            “Add box below” saves this box and creates a new one reporting to it. Deleting a
            box also deletes everything under it{isRoot ? ", including the whole chart" : ""}.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChainOfCommand({ page, user }) {
  const { config, mutate } = useConfig();
  const canEdit = canEditFleet(user, config);
  const cfg = page?.config || {};
  const root = cfg.root || null;
  const accent = cfg.accent || "var(--color-primary)";

  const [editing, setEditing] = useState(null); // node being edited
  const [confirmDelete, setConfirmDelete] = useState(null);
  const editingM = useModalData(editing);

  const setCfg = (patch) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === page.id ? { ...p, config: { ...(p.config || {}), ...patch } } : p
      ),
    }));
  const setRoot = (next) => setCfg({ root: next });

  const cleanMembers = (draft) => ({
    ...draft,
    members: (draft.members || []).map((m) => m.trim()).filter(Boolean),
  });

  function saveNode(draft) {
    setRoot(updateNode(root, draft.id, cleanMembers(draft)));
    setEditing(null);
  }
  function addBelow(draft) {
    const child = newNode();
    setRoot(addChild(updateNode(root, draft.id, cleanMembers(draft)), draft.id, child));
    setEditing(child);
  }
  // From the dashed "+ Add box" slots on the chart itself.
  function addChildTo(nodeId) {
    const child = newNode();
    setRoot(addChild(root, nodeId, child));
    setEditing(child);
  }
  function move(dir) {
    setRoot(moveNode(root, editing.id, dir));
  }

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker || "Personnel"}
        title={cfg.heroTitle || page?.label || "Chain of Command"}
        subtitle={
          cfg.heroSubtitle ||
          (canEdit
            ? "Use the dashed “Add box” slots to grow the chart; click any box to edit it."
            : "Who reports to whom, from the top down.")
        }
        actions={
          canEdit &&
          !root && (
            <Button
              icon={Plus}
              onClick={() => {
                const r = newNode("Chief");
                setRoot(r);
                setEditing(r);
              }}
            >
              Start the chart
            </Button>
          )
        }
      />

      {!root ? (
        <Panel className="p-10 text-center">
          <Network size={32} className="mx-auto mb-3 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No chain of command yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Start with the top position (Chief, Colonel…), then add boxes below it to build
            the chart down through your ranks.
          </p>
          {canEdit && (
            <Button
              icon={Plus}
              className="mt-4"
              onClick={() => {
                const r = newNode("Chief");
                setRoot(r);
                setEditing(r);
              }}
            >
              Start the chart
            </Button>
          )}
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-6">
          <div className="flex min-w-max justify-center">
            <NodeTree
              node={root}
              accent={accent}
              canEdit={canEdit}
              onEdit={setEditing}
              onAddChild={addChildTo}
            />
          </div>
        </Panel>
      )}

      {/* Notes */}
      {(cfg.notes || (canEdit && root)) && (
        <Panel className="mt-4 p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Notes
          </div>
          {canEdit ? (
            <Textarea
              rows={2}
              value={cfg.notes || ""}
              placeholder="e.g. Contact your direct supervisor first, then move up the chain…"
              onChange={(e) => setCfg({ notes: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{cfg.notes}</p>
          )}
        </Panel>
      )}

      {editingM.data && (
        <NodeModal
          key={editingM.key}
          open={editingM.open}
          onClose={() => setEditing(null)}
          node={editingM.data}
          isRoot={root?.id === editingM.data.id}
          onSave={saveNode}
          onAddChild={addBelow}
          onMove={move}
          onDelete={() => {
            setConfirmDelete(editingM.data);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this box?"
        message={
          root?.id === confirmDelete?.id
            ? "This is the top of the chart, deleting it removes the entire chain of command."
            : `Delete "${confirmDelete?.title}" and the ${Math.max(0, countNodes(confirmDelete) - 1)} box(es) under it?`
        }
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          setRoot(deleteNode(root, confirmDelete.id));
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
