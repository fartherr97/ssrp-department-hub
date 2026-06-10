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
  MediaInput,
  useModalData,
} from "../components/common/index.jsx";
import { safeMediaUrl } from "../lib/urls.js";

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

// Robust check that the active drag is one of our boxes (types can be an
// array or a DOMStringList depending on the browser).
const hasNodeDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("text/coc-node");

function newNode(title = "New Position") {
  return { id: uid("node"), title, name: "", color: "", imageUrl: "", members: [], children: [] };
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

function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const c of root.children || []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

function isDescendant(node, id) {
  if (!node) return false;
  if (node.id === id) return true;
  return (node.children || []).some((c) => isDescendant(c, id));
}

// Drag-and-drop move: re-parent a node (mode "child") or slot it beside a
// sibling ("before"/"after"). The tree layout itself keeps everything aligned.
function moveNodeTo(root, dragId, targetId, mode) {
  if (!root || dragId === targetId || root.id === dragId) return root;
  const dragNode = findNode(root, dragId);
  // Never drop a box into its own subtree, that would orphan the branch.
  if (!dragNode || isDescendant(dragNode, targetId)) return root;

  let moved = null;
  const prune = (n) => ({
    ...n,
    children: (n.children || [])
      .filter((c) => {
        if (c.id === dragId) {
          moved = c;
          return false;
        }
        return true;
      })
      .map(prune),
  });
  const stripped = prune(root);
  if (!moved) return root;

  if (mode === "child") {
    return mapTree(stripped, (n) =>
      n.id === targetId ? { ...n, children: [...(n.children || []), moved] } : n
    );
  }
  // before/after: insert among the target's siblings (no-op if target is root).
  return mapTree(stripped, (n) => {
    const kids = n.children || [];
    const i = kids.findIndex((c) => c.id === targetId);
    if (i === -1) return n;
    const next = [...kids];
    next.splice(mode === "before" ? i : i + 1, 0, moved);
    return { ...n, children: next };
  });
}

// ── Rendering ────────────────────────────────────────────────────────────────

function NodeCard({ node, accent, canEdit, isRoot, onEdit, dropHint, setDropHint, onDropNode, canDropOn, setDragId }) {
  const color = node.color || accent;
  const myHint = dropHint?.targetId === node.id ? dropHint.mode : null;

  // Which drop zone the cursor is over: outer quarters = insert beside,
  // middle = move under this box.
  const zoneFor = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (isRoot) return "child"; // nothing sits beside the top box
    if (x < 0.3) return "before";
    if (x > 0.7) return "after";
    return "child";
  };

  const hintStyle =
    myHint === "before"
      ? { boxShadow: "inset 4px 0 0 0 var(--color-primary)" }
      : myHint === "after"
      ? { boxShadow: "inset -4px 0 0 0 var(--color-primary)" }
      : myHint === "child"
      ? { boxShadow: "inset 0 0 0 2px var(--color-primary)" }
      : undefined;

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => onEdit(node)}
      title={canEdit ? "Click to edit. Drag onto another box to move under it, or to a box's edge to slot beside it." : undefined}
      draggable={canEdit && !isRoot}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/coc-node", node.id);
        setDragId(node.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setDropHint(null);
      }}
      onDragOver={(e) => {
        if (!canEdit || !hasNodeDrag(e) || !canDropOn(node.id)) return;
        e.preventDefault();
        const mode = zoneFor(e);
        if (myHint !== mode) setDropHint({ targetId: node.id, mode });
      }}
      onDragLeave={() => {
        if (myHint) setDropHint(null);
      }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        const dragId = e.dataTransfer.getData("text/coc-node");
        if (dragId) onDropNode(dragId, node.id, zoneFor(e));
      }}
      style={{
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, var(--color-surface-2))`,
        ...hintStyle,
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

function NodeTree({ node, accent, canEdit, isRoot = true, onEdit, onAddChild, dropHint, setDropHint, onDropNode, canDropOn, setDragId }) {
  const children = node.children || [];
  return (
    <div className="flex flex-col items-center">
      {safeMediaUrl(node.imageUrl) && (
        <img
          src={safeMediaUrl(node.imageUrl)}
          alt={node.title}
          className="mb-1.5 h-14 w-14 object-contain"
        />
      )}
      <NodeCard
        node={node}
        accent={accent}
        canEdit={canEdit}
        isRoot={isRoot}
        onEdit={onEdit}
        dropHint={dropHint}
        setDropHint={setDropHint}
        onDropNode={onDropNode}
        canDropOn={canDropOn}
        setDragId={setDragId}
      />
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
                isRoot={false}
                onEdit={onEdit}
                onAddChild={onAddChild}
                dropHint={dropHint}
                setDropHint={setDropHint}
                onDropNode={onDropNode}
                canDropOn={canDropOn}
                setDragId={setDragId}
              />
            </div>
          ))}
          {canEdit && (
            // A dashed slot under every box: click to add a box there, or
            // drop a dragged box onto it to move it into that spot.
            <div className="flex flex-col items-center">
              <div className="my-1 h-[13px]" />
              <button
                type="button"
                onClick={() => onAddChild(node.id)}
                title={`Add a box under “${node.title}”, or drop a dragged box here to move it under “${node.title}”`}
                onDragOver={(e) => {
                  if (!hasNodeDrag(e) || !canDropOn(node.id)) return;
                  e.preventDefault();
                  if (dropHint?.targetId !== node.id || dropHint?.mode !== "slot") {
                    setDropHint({ targetId: node.id, mode: "slot" });
                  }
                }}
                onDragLeave={() => {
                  if (dropHint?.mode === "slot" && dropHint?.targetId === node.id) setDropHint(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const dragId = e.dataTransfer.getData("text/coc-node");
                  if (dragId) onDropNode(dragId, node.id, "child");
                }}
                className={`press flex h-[46px] w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs font-semibold transition ${
                  dropHint?.targetId === node.id && dropHint?.mode === "slot"
                    ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/15 text-[var(--color-primary)]"
                    : "border-white/20 text-slate-500 hover:border-[color:var(--color-border-strong)] hover:text-[var(--color-primary)]"
                }`}
              >
                <Plus size={13} />
                {dropHint?.targetId === node.id && dropHint?.mode === "slot" ? "Move here" : "Add box"}
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
          label="Logo / insignia"
          hint="Optional, shows above the box, e.g. a subdivision patch or unit badge. Paste a link or upload."
        >
          <MediaInput
            value={draft.imageUrl || ""}
            maxDim={256}
            onChange={(imageUrl) => setDraft({ ...draft, imageUrl })}
          />
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
  const [dropHint, setDropHint] = useState(null); // { targetId, mode } while dragging
  const [dragId, setDragId] = useState(null); // box currently being dragged
  const editingM = useModalData(editing);

  // Whether the dragged box may land on `targetId`: not itself, and never
  // anywhere inside its own branch (that would orphan it). Invalid targets
  // don't light up and the browser shows a "no drop" cursor.
  const canDropOn = (targetId) =>
    Boolean(dragId) && dragId !== targetId && !isDescendant(findNode(root, dragId), targetId);

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
  function handleDropNode(dragId, targetId, mode) {
    setDropHint(null);
    setRoot(moveNodeTo(root, dragId, targetId, mode));
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
            ? "Use the dashed “Add box” slots to grow the chart, click a box to edit it, or drag one onto another box (or its edge) to move it."
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
              dropHint={dropHint}
              setDropHint={setDropHint}
              onDropNode={handleDropNode}
              canDropOn={canDropOn}
              setDragId={setDragId}
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
