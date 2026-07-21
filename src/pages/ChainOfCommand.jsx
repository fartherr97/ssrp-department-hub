import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Network, ZoomIn, ZoomOut, Maximize2, Minimize2, DownloadCloud, Link2, AlertTriangle } from "lucide-react";
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
  Select,
  Textarea,
  ColorInput,
  MediaInput,
  useModalData,
} from "../components/common/index.jsx";
import { safeMediaUrl } from "../lib/urls.js";
import { resolveNodeLink, resolveNodeDisplay, splitTitle } from "../lib/chain.js";

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


// ── Auto-import an org chart from the roster ─────────────────────────────────
// Builds a COMPACT leadership pyramid, not the whole roster: it takes only the
// top few rank tiers (Colonel → Captains for a typical dept) so the chart stays
// readable and the rest is filled in by hand. Ranks are grouped into tiers by
// their base name (rank order = seniority), and each box is placed under the
// senior in the tier above that shares the most of its "position" words — so a
// "Captain - Patrol Operations A" lands under "Major - Operations Bureau" rather
// than scattering. Unmatched boxes go under the first senior, keeping a bureau's
// units together instead of round-robining them across the chart.

// How many rank tiers to import. Keeps the auto-chart a compact top-of-house
// pyramid; editors grow the lower ranks manually from there.
const MAX_IMPORT_TIERS = 4;

const baseOf = (name) => String(name || "").split(" - ")[0].trim();
const positionOf = (name) => {
  const i = String(name || "").indexOf(" - ");
  return i >= 0 ? name.slice(i + 3).trim().toLowerCase() : "";
};

// The distinguishing words of a position ("patrol operations a" → patrol,
// operations). Only bare connectors are dropped — unlike the old matcher we KEEP
// unit words like "operations"/"bureau"/"troop"/"division", because those are
// exactly what tie a captain to the right bureau.
const CONNECTORS = new Set(["and", "the", "of", "for", "a", "an", "to", "at", "in"]);
function positionWords(pos) {
  return new Set(
    String(pos || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !CONNECTORS.has(w))
  );
}

// Pick the senior box whose position shares the most words with `pos`. Returns
// null when there's no overlap at all (caller then falls back to the first).
function bestSeniorFor(seniors, pos) {
  const want = positionWords(pos);
  if (!want.size) return null;
  let best = null;
  let bestScore = 0;
  for (const s of seniors) {
    const have = positionWords(positionOf(s.title));
    let score = 0;
    for (const w of want) if (have.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

// ── Live roster links ────────────────────────────────────────────────────────
// A box may carry a `link` describing what roster data it mirrors, so the chart
// stays in sync as the roster changes. Kinds (department-agnostic — the picker
// reads each dept's own ranks/columns/categories):
//   { subId, kind: "rank",     rankId }            → holders of a rank/position
//   { subId, kind: "field",    fieldId, value }    → members whose column = value
//   { subId, kind: "category", categoryId }        → members in a category band
// Resolution never throws; a link whose target was renamed/deleted reports
// ok:false so the box can fall back to its last-known cached name/members.
export function buildTreeFromRoster(config, subId) {
  const subs = config?.roster?.subdivisions || [];
  const sub = subs.find((s) => s.id === subId) || subs.find((s) => s.main) || subs[0];
  if (!sub) return { root: null, count: 0, subName: "" };

  const holdersByRank = new Map();
  for (const cat of sub.categories || [])
    for (const m of cat.members || [])
      if (m.rank) {
        if (!holdersByRank.has(m.rank)) holdersByRank.set(m.rank, []);
        holdersByRank.get(m.rank).push(m.name || "Unnamed");
      }
  const withHolders = (sub.ranks || []).filter((r) => (holdersByRank.get(r.id) || []).length);
  if (!withHolders.length) return { root: null, count: 0, subName: sub.name };

  // Group the held ranks into tiers by base rank name (seniority order), then
  // keep only the top few so the chart stays a compact leadership pyramid.
  const tiers = [];
  let curBase = null;
  for (const r of withHolders) {
    const base = baseOf(r.name);
    if (base !== curBase) {
      tiers.push([]);
      curBase = base;
    }
    tiers[tiers.length - 1].push(r);
  }
  const kept = tiers.slice(0, MAX_IMPORT_TIERS);

  const mk = (title, holders) => ({
    id: uid("node"),
    title,
    name: holders.length === 1 ? holders[0] : "",
    color: "",
    imageUrl: "",
    members: holders.length > 1 ? holders : [],
    children: [],
  });

  const root = mk(sub.name || "Command", []);
  let count = 1;
  let seniors = [root];

  for (const tier of kept) {
    const nodes = tier.map((r) => {
      count++;
      // Auto-link each imported box to its rank so it stays live: rename or
      // reassign the holder on the roster and the chart follows. The copied
      // name/members stay as a fallback if the rank is later deleted.
      return { ...mk(r.name, holdersByRank.get(r.id) || []), link: { subId: sub.id, kind: "rank", rankId: r.id } };
    });
    tier.forEach((r, i) => {
      // A single senior owns the whole tier below it (boxes fan out as siblings);
      // with several seniors, group each box under the best bureau/troop match.
      let parent = seniors.length > 1 ? bestSeniorFor(seniors, positionOf(r.name)) : null;
      if (!parent) parent = seniors[0];
      parent.children.push(nodes[i]);
    });
    seniors = nodes;
  }
  return { root, count, subName: sub.name };
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

function addChild(root, id, child, position = "end") {
  return mapTree(root, (n) =>
    n.id === id
      ? {
          ...n,
          children:
            position === "start" ? [child, ...(n.children || [])] : [...(n.children || []), child],
        }
      : n
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

  let result;
  if (mode === "child") {
    result = mapTree(stripped, (n) =>
      n.id === targetId ? { ...n, children: [...(n.children || []), moved] } : n
    );
  } else {
    // before/after: insert among the target's siblings.
    result = mapTree(stripped, (n) => {
      const kids = n.children || [];
      const i = kids.findIndex((c) => c.id === targetId);
      if (i === -1) return n;
      const next = [...kids];
      next.splice(mode === "before" ? i : i + 1, 0, moved);
      return { ...n, children: next };
    });
  }
  // Safety net: if the insertion point didn't exist (e.g. before/after the
  // root), abort rather than silently deleting the detached branch.
  return findNode(result, dragId) ? result : root;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function NodeCard({ node, disp, accent, canEdit, isRoot, onEdit, dropHint, setDropHint, onDropNode, canDropOn, setDragId }) {
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
      className={`relative w-44 rounded-lg border px-2 py-1.5 text-center ${
        canEdit ? "press cursor-pointer hover:brightness-125" : "cursor-default"
      }`}
    >
      {disp?.linked && (
        <span
          className="absolute right-1 top-1"
          title={
            disp.broken
              ? "Roster link broken (its rank/column was removed). Showing the last known name; re-link or edit this box."
              : "Filled from the roster, updates automatically."
          }
        >
          {disp.broken ? (
            <AlertTriangle size={11} className="text-amber-400" />
          ) : (
            <Link2 size={11} className="text-slate-500" />
          )}
        </span>
      )}
      {(() => {
        const { rank, sub } = splitTitle(node.title || "Untitled");
        return (
          <>
            <div
              className="truncate text-[11px] font-bold uppercase tracking-wide"
              style={{ color }}
              title={node.title}
            >
              {rank || "Untitled"}
            </div>
            {sub && (
              <div
                className="break-words text-[10px] font-semibold uppercase leading-tight tracking-wide"
                style={{ color: `color-mix(in srgb, ${color} 78%, var(--color-text-muted))` }}
                title={node.title}
              >
                {sub}
              </div>
            )}
          </>
        );
      })()}
      {disp?.vacant ? (
        <div className="truncate text-[13px] font-semibold italic text-slate-500">Vacant</div>
      ) : disp?.name ? (
        <div className="truncate text-[13px] font-bold text-white" title={disp.name}>
          {disp.name}
        </div>
      ) : null}
    </button>
  );
}

function MemberColumn({ members, color: colorProp, accent }) {
  const list = (members || []).filter(Boolean);
  if (!list.length) return null;
  const color = colorProp || accent;
  return (
    <div className="mt-1.5 grid w-44 gap-1">
      {list.map((m, i) => (
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

/*
 * The "+" slot under each box: a small dot normally (click to add a box
 * there); while a drag is in progress, valid slots expand into "Drop here"
 * targets and invalid ones (inside the dragged branch) stay dim dots.
 */
function SlotButton({ title, dragging, valid, hinted, setHint, onDropId, onAdd, compact = false }) {
  if (dragging && valid) {
    const dnd = {
      onDragOver: (e) => {
        if (!hasNodeDrag(e)) return;
        e.preventDefault();
        if (!hinted) setHint(true);
      },
      onDragLeave: () => hinted && setHint(false),
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/coc-node");
        if (id) onDropId(id);
      },
    };
    // Side slots have no layout width of their own, so they stay small
    // circles during a drag instead of covering the neighboring boxes.
    if (compact) {
      return (
        <button
          type="button"
          title="Drop here"
          {...dnd}
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-dashed bg-[var(--color-surface-1)] transition ${
            hinted
              ? "scale-110 border-[var(--color-primary)] bg-[color:var(--color-primary)]/20 text-[var(--color-primary)]"
              : "border-white/30 text-slate-400"
          }`}
        >
          <Plus size={14} />
        </button>
      );
    }
    return (
      <button
        type="button"
        {...dnd}
        className={`flex h-[42px] w-44 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-[var(--color-surface-1)] text-xs font-semibold transition ${
          hinted
            ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/15 text-[var(--color-primary)]"
            : "border-white/25 text-slate-400"
        }`}
      >
        <Plus size={13} />
        {hinted ? "Move here" : "Drop here"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      title={title}
      className={`press mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-dashed bg-[var(--color-surface-1)] transition ${
        dragging
          ? "border-white/10 text-slate-700"
          : "border-white/25 text-slate-500 hover:border-[color:var(--color-border-strong)] hover:text-[var(--color-primary)]"
      }`}
    >
      <Plus size={12} />
    </button>
  );
}

function NodeTree({ node, resolve, accent, canEdit, isRoot = true, onEdit, onAddChild, dropHint, setDropHint, onDropNode, canDropOn, setDragId, dragId }) {
  const children = node.children || [];
  const disp = resolve(node);
  // Only real boxes count for layout/centering, the editor's "+" slot hangs
  // off to the side with zero width so parents center over their children.
  const total = children.length;
  const showRow = total > 0 || canEdit;
  // Half-width rail segments joining the children's stubs into one connector.
  const rails = (i) =>
    total > 1 ? (
      <>
        {i > 0 && <span className="absolute left-0 top-0 h-px w-1/2 bg-white/15" />}
        {i < total - 1 && <span className="absolute right-0 top-0 h-px w-1/2 bg-white/15" />}
      </>
    ) : null;

  return (
    <div className="flex flex-col items-center">
      {safeMediaUrl(node.imageUrl) && (
        <img
          src={safeMediaUrl(node.imageUrl)}
          alt={node.title}
          // Hide instead of showing a broken-image icon if the link doesn't load.
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          onLoad={(e) => {
            e.currentTarget.style.display = "";
          }}
          className="mb-1.5 h-14 w-14 object-contain"
        />
      )}
      <NodeCard
        node={node}
        disp={disp}
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
      <MemberColumn members={disp.members} color={node.color} accent={accent} />
      {showRow && (
        <>
          <span className="h-3 w-px bg-white/15" />
          <div className="group/kids flex items-start">
            {canEdit && total > 0 && (
              // Zero-width appendage on the LEFT: adds/drops a box at the
              // front of this row without affecting layout or centering.
              <div className="relative w-0 self-stretch">
                <div
                  className={`absolute right-1 top-2 z-10 transition-opacity ${
                    dragId ? "opacity-100" : "opacity-0 group-hover/kids:opacity-100"
                  }`}
                >
                  <SlotButton
                    title={`Add a box under \u201c${node.title}\u201d (left side)`}
                    dragging={Boolean(dragId)}
                    valid={!dragId || canDropOn(children[0].id)}
                    hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot-start"}
                    setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot-start" } : null)}
                    onDropId={(id) => onDropNode(id, children[0].id, "before")}
                    onAdd={() => onAddChild(node.id, "start")}
                    compact
                  />
                </div>
              </div>
            )}
            {children.map((child, i) => (
              <div key={child.id} className="relative flex flex-col items-center px-1.5">
                {rails(i)}
                <span className="h-3 w-px bg-white/15" />
                <NodeTree
                  node={child}
                  resolve={resolve}
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
                  dragId={dragId}
                />
              </div>
            ))}
            {canEdit && total > 0 && (
              // Zero-width appendage on the RIGHT: adds/drops at the end.
              <div className="relative w-0 self-stretch">
                <div
                  className={`absolute left-1 top-2 z-10 transition-opacity ${
                    dragId ? "opacity-100" : "opacity-0 group-hover/kids:opacity-100"
                  }`}
                >
                  <SlotButton
                    title={`Add a box under \u201c${node.title}\u201d`}
                    dragging={Boolean(dragId)}
                    valid={!dragId || canDropOn(node.id)}
                    hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot"}
                    setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot" } : null)}
                    onDropId={(id) => onDropNode(id, node.id, "child")}
                    onAdd={() => onAddChild(node.id, "end")}
                    compact
                  />
                </div>
              </div>
            )}
            {canEdit && total === 0 && (
              <div className="flex flex-col items-center px-1.5">
                <span className="h-3 w-px bg-white/15" />
                <SlotButton
                  title={`Add a box under \u201c${node.title}\u201d`}
                  dragging={Boolean(dragId)}
                  valid={!dragId || canDropOn(node.id)}
                  hinted={dropHint?.targetId === node.id && dropHint?.mode === "slot"}
                  setHint={(on) => setDropHint(on ? { targetId: node.id, mode: "slot" } : null)}
                  onDropId={(id) => onDropNode(id, node.id, "child")}
                  onAdd={() => onAddChild(node.id, "end")}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Box editor modal ─────────────────────────────────────────────────────────

// Picks what live roster data (if any) a box mirrors. Reads the department's own
// ranks / columns / categories, so it works whatever they're called (FHP
// "troops" live in rank names, HCSO uses a "Division" column, etc.).
function LinkEditor({ config, link, onChange }) {
  const subs = config?.roster?.subdivisions || [];
  const fields = config?.roster?.memberFields || [];
  const kind = link?.kind || "";
  const subId = link?.subId || (subs.find((s) => s.main) || subs[0])?.id || "";
  const sub = subs.find((s) => s.id === subId) || subs.find((s) => s.main) || subs[0] || null;
  const field = fields.find((f) => f.id === link?.fieldId);
  const preview = link ? resolveNodeLink(config, link) : null;

  const patch = (p) => onChange({ ...link, ...p });
  const setKind = (k) => {
    if (!k) return onChange(null);
    const base = { subId };
    if (k === "rank") onChange({ ...base, kind: "rank", rankId: sub?.ranks?.[0]?.id || "" });
    else if (k === "field") {
      const f = fields[0];
      onChange({ ...base, kind: "field", fieldId: f?.id || "", value: f?.options?.[0] || "" });
    } else onChange({ ...base, kind: "category", categoryId: sub?.categories?.[0]?.id || "" });
  };
  const setSub = (id) => {
    const ns = subs.find((s) => s.id === id);
    const p = { subId: id };
    if (kind === "rank") p.rankId = ns?.ranks?.[0]?.id || "";
    if (kind === "category") p.categoryId = ns?.categories?.[0]?.id || "";
    onChange({ ...link, ...p });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <Field
        label="Fill from roster"
        hint="Link this box to live roster data so it updates automatically when the roster changes."
      >
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Not linked — type the name(s) by hand</option>
          <option value="rank">A rank / position — shows its current holder(s)</option>
          <option value="field">A roster column value — e.g. Division = District 3</option>
          <option value="category">A category / grouping band</option>
        </Select>
      </Field>

      {kind && (kind === "rank" || kind === "category") && subs.length > 1 && (
        <Field label="Roster" className="mt-2">
          <Select value={subId} onChange={(e) => setSub(e.target.value)}>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
      )}

      {kind === "rank" && (
        <Field label="Rank / position" className="mt-2">
          <Select value={link.rankId || ""} onChange={(e) => patch({ rankId: e.target.value })}>
            <option value="">Select a rank…</option>
            {(sub?.ranks || []).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </Field>
      )}

      {kind === "field" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Column">
            <Select
              value={link.fieldId || ""}
              onChange={(e) => {
                const f = fields.find((x) => x.id === e.target.value);
                patch({ fieldId: e.target.value, value: f?.options?.[0] || "" });
              }}
            >
              <option value="">Select a column…</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Equals">
            {field?.options?.length ? (
              <Select value={link.value || ""} onChange={(e) => patch({ value: e.target.value })}>
                <option value="">Select a value…</option>
                {field.options.map((o, i) => (
                  <option key={`${i}-${o}`} value={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input
                value={link.value || ""}
                onChange={(e) => patch({ value: e.target.value })}
                placeholder="Value to match"
              />
            )}
          </Field>
        </div>
      )}

      {kind === "category" && (
        <Field label="Category" className="mt-2">
          <Select value={link.categoryId || ""} onChange={(e) => patch({ categoryId: e.target.value })}>
            <option value="">Select a category…</option>
            {(sub?.categories || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      )}

      {link && (
        <p className="mt-2 text-xs text-slate-400">
          {!preview.ok
            ? "⚠ Link target not found on the roster. The box keeps its last saved name until you re-link it."
            : preview.names.length === 0
            ? "Currently vacant — no one on the roster matches yet."
            : `Currently: ${preview.names.join(", ")}`}
        </p>
      )}
    </div>
  );
}

function NodeModal({ open, onClose, node, isRoot, config, onSave, onAddChild, onMove, onDelete }) {
  const [draft, setDraft] = useState(node);
  const membersText = (draft.members || []).join("\n");
  const linked = Boolean(draft.link);

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
          {!linked && (
            <Field label="Name(s)" hint="Who holds it, e.g. J. Welch. Blank = vacant.">
              <Input
                value={draft.name || ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
          )}
        </div>
        <LinkEditor
          config={config}
          link={draft.link || null}
          onChange={(link) => setDraft({ ...draft, link: link || undefined })}
        />
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
        {!linked && (
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
        )}

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

  // Resolve a box's live display (linked roster names, or its hand-typed values).
  // Memoized on config so a roster edit re-renders the chart with fresh names.
  const resolve = useCallback((node) => resolveNodeDisplay(config, node), [config]);

  const [editing, setEditing] = useState(null); // node being edited
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmImport, setConfirmImport] = useState(null); // { root, count, subName }
  const [dropHint, setDropHint] = useState(null); // { targetId, mode } while dragging
  const [dragId, setDragId] = useState(null); // box currently being dragged
  const [zoom, setZoom] = useState(1);
  const panRef = useRef(null);
  const panState = useRef(null);
  // Fullscreen the chart canvas via the browser Fullscreen API.
  const fsRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === fsRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else fsRef.current?.requestFullscreen?.();
  };
  // Ctrl/Cmd + scroll (and trackpad pinch) zooms the chart, in or out of
  // fullscreen. Native listener because React wheel handlers are passive.
  useEffect(() => {
    const el = panRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(1.5, Math.max(0.4, +(z + step).toFixed(2))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
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
  function addChildTo(nodeId, position = "end") {
    const child = newNode();
    setRoot(addChild(root, nodeId, child, position));
    setEditing(child);
  }
  function handleDropNode(dragId, targetId, mode) {
    setDropHint(null);
    setRoot(moveNodeTo(root, dragId, targetId, mode));
  }
  function move(dir) {
    setRoot(moveNode(root, editing.id, dir));
  }
  function importFromRoster() {
    const built = buildTreeFromRoster(config);
    if (!built.root) return;
    if (root) setConfirmImport(built); // replacing an existing chart → confirm
    else {
      setRoot(built.root);
      setZoom(1); // compact chart fits at full size
    }
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
          canEdit && (
            <>
              <Button variant="secondary" icon={DownloadCloud} onClick={importFromRoster}>
                Import from roster
              </Button>
              {!root && (
                <Button
                  icon={Plus}
                  onClick={() => {
                    const r = newNode("Chief");
                    setRoot(r);
                    setEditing(r);
                  }}
                >
                  Start blank
                </Button>
              )}
            </>
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button icon={DownloadCloud} onClick={importFromRoster}>
                Import from roster
              </Button>
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => {
                  const r = newNode("Chief");
                  setRoot(r);
                  setEditing(r);
                }}
              >
                Start blank
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="relative">
          <div
            ref={fsRef}
            className="relative"
            style={isFullscreen ? { background: "var(--color-body-bg)", padding: "1rem" } : undefined}
          >
          {/* Zoom + fullscreen controls */}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-[var(--color-surface-1)]/95 p-1">
            <IconButton
              icon={ZoomOut}
              label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
              className="h-7 w-7"
            />
            <button
              onClick={() => setZoom(1)}
              title="Reset zoom"
              className="w-10 text-center text-[11px] font-bold text-slate-400 transition hover:text-white"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconButton
              icon={ZoomIn}
              label="Zoom in"
              onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
              className="h-7 w-7"
            />
            <IconButton
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
              className="h-7 w-7"
            />
            <span className="hidden whitespace-nowrap px-1.5 text-[10px] font-semibold text-slate-500 lg:block">
              drag to pan · Ctrl+scroll zooms
            </span>
          </div>

          {/* Pannable, zoomable chart canvas */}
          <div
            ref={panRef}
            onMouseDown={(e) => {
              // Grab-to-pan: middle mouse anywhere, left mouse on the
              // background (boxes keep their own drag behavior).
              if (e.button !== 1 && (e.button !== 0 || e.target.closest("button, img, input"))) return;
              e.preventDefault();
              panState.current = {
                x: e.clientX,
                y: e.clientY,
                sl: panRef.current.scrollLeft,
                st: panRef.current.scrollTop,
              };
            }}
            onMouseMove={(e) => {
              const ps = panState.current;
              if (!ps) return;
              panRef.current.scrollLeft = ps.sl - (e.clientX - ps.x);
              panRef.current.scrollTop = ps.st - (e.clientY - ps.y);
            }}
            onMouseUp={() => (panState.current = null)}
            onMouseLeave={() => (panState.current = null)}
            className={`cursor-grab select-none overflow-auto p-6 active:cursor-grabbing ${
              isFullscreen ? "h-full max-h-none" : "max-h-[72vh]"
            }`}
          >
            <div style={{ zoom }} className="mx-auto w-max">
              <NodeTree
                node={root}
                resolve={resolve}
                accent={accent}
                canEdit={canEdit}
                onEdit={setEditing}
                onAddChild={addChildTo}
                dropHint={dropHint}
                setDropHint={setDropHint}
                onDropNode={handleDropNode}
                canDropOn={canDropOn}
                setDragId={setDragId}
                dragId={dragId}
              />
            </div>
          </div>
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
          config={config}
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

      <ConfirmDialog
        open={Boolean(confirmImport)}
        title="Import from roster?"
        message={`Replace the current chart with ${confirmImport?.count || 0} boxes: the top leadership tiers of ${
          confirmImport?.subName || "the roster"
        } (down to captains), grouped by bureau or troop. It's a compact starting pyramid, add the lower ranks by hand or drag boxes to rearrange.`}
        confirmLabel="Import & replace"
        onCancel={() => setConfirmImport(null)}
        onConfirm={() => {
          setRoot(confirmImport.root);
          setZoom(1); // compact chart fits at full size
          setConfirmImport(null);
        }}
      />
    </div>
  );
}
