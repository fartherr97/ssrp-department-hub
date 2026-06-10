import { memo } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Type, Info, Link2, Image as ImageIcon, Clapperboard, AppWindow, Columns2, UserSquare2 } from "lucide-react";
import {
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  MediaInput,
} from "../../components/common/index.jsx";
import { uid } from "../../lib/roster.js";

const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type, desc: "A heading with paragraph text" },
  { value: "callout", label: "Callout", icon: Info, desc: "A highlighted notice box" },
  { value: "links", label: "Link list", icon: Link2, desc: "A titled list of clickable links" },
  { value: "image", label: "Image", icon: ImageIcon, desc: "A picture or banner, with optional caption" },
  { value: "video", label: "Video", icon: Clapperboard, desc: "A YouTube link, video URL, or small upload" },
  { value: "embed", label: "Embed", icon: AppWindow, desc: "Embed a Google Doc, form, or other site" },
  { value: "columns", label: "Two columns", icon: Columns2, desc: "Two text columns side by side" },
  { value: "spotlight", label: "Spotlight", icon: UserSquare2, desc: "Cards highlighting people (photo, name, role)" },
];

// What a freshly added block of each type starts with.
function emptyBlock(type) {
  const base = { id: uid("block"), type, title: "" };
  switch (type) {
    case "links":
      return { ...base, items: [] };
    case "image":
      return { ...base, url: "", caption: "" };
    case "video":
      return { ...base, url: "" };
    case "embed":
      return { ...base, url: "", height: 480 };
    case "columns":
      return { ...base, left: "", right: "" };
    case "spotlight":
      return { ...base, items: [] };
    default:
      return { ...base, body: "" };
  }
}

// ─── Per-type editors ────────────────────────────────────────────────────────

function LinksEditor({ block, update }) {
  const setItems = (items) => update({ items });
  return (
    <div className="mt-3 grid gap-2">
      {(block.items || []).map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            placeholder="Label"
            value={item.label}
            onChange={(e) =>
              setItems(block.items.map((it) => (it.id === item.id ? { ...it, label: e.target.value } : it)))
            }
          />
          <Input
            placeholder="https://…"
            value={item.url}
            onChange={(e) =>
              setItems(block.items.map((it) => (it.id === item.id ? { ...it, url: e.target.value } : it)))
            }
          />
          <IconButton
            icon={Trash2}
            label="Remove link"
            onClick={() => setItems(block.items.filter((it) => it.id !== item.id))}
            className="hover:border-red-500/40 hover:text-red-300"
          />
        </div>
      ))}
      <Button
        variant="ghost"
        icon={Plus}
        className="justify-self-start"
        onClick={() => setItems([...(block.items || []), { id: uid("link"), label: "", url: "" }])}
      >
        Add link
      </Button>
    </div>
  );
}

function ImageEditor({ block, update }) {
  return (
    <div className="mt-3 grid gap-3">
      <Field label="Image" hint="Paste an image link, or upload one from your computer.">
        <MediaInput value={block.url} onChange={(url) => update({ url })} maxDim={1600} />
      </Field>
      <Field label="Caption" hint="Small text under the image. Optional.">
        <Input value={block.caption || ""} onChange={(e) => update({ caption: e.target.value })} />
      </Field>
    </div>
  );
}

function VideoEditor({ block, update }) {
  return (
    <div className="mt-3">
      <Field
        label="Video"
        hint="Paste a YouTube link (plays right on the page), a direct video link (e.g. from Discord), or upload a small clip (under ~2.5 MB)."
      >
        <MediaInput kind="video" value={block.url} onChange={(url) => update({ url })} placeholder="https://youtube.com/watch?v=… or upload" />
      </Field>
    </div>
  );
}

function EmbedEditor({ block, update }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
      <Field
        label="Link to embed"
        hint='Works with Google Docs/Sheets/Forms ("Share → Publish to web"), maps, and most sites that allow embedding.'
      >
        <Input
          value={block.url || ""}
          placeholder="https://docs.google.com/…"
          onChange={(e) => update({ url: e.target.value })}
        />
      </Field>
      <Field label="Height (px)">
        <Input
          type="number"
          value={block.height ?? 480}
          onChange={(e) => update({ height: Number(e.target.value) || 480 })}
        />
      </Field>
    </div>
  );
}

function ColumnsEditor({ block, update }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Left column">
        <Textarea value={block.left || ""} onChange={(e) => update({ left: e.target.value })} />
      </Field>
      <Field label="Right column">
        <Textarea value={block.right || ""} onChange={(e) => update({ right: e.target.value })} />
      </Field>
    </div>
  );
}

function SpotlightEditor({ block, update }) {
  const items = block.items || [];
  const setItems = (next) => update({ items: next });
  const updateItem = (id, patch) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  return (
    <div className="mt-3 grid gap-3">
      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Name">
              <Input value={p.name || ""} onChange={(e) => updateItem(p.id, { name: e.target.value })} />
            </Field>
            <Field label="Role / title">
              <Input value={p.role || ""} onChange={(e) => updateItem(p.id, { role: e.target.value })} />
            </Field>
            <IconButton
              icon={Trash2}
              label="Remove person"
              onClick={() => setItems(items.filter((it) => it.id !== p.id))}
              className="mt-5 hover:border-red-500/40 hover:text-red-300"
            />
          </div>
          <div className="mt-2 grid gap-2">
            <Field label="Photo">
              <MediaInput value={p.photoUrl} onChange={(photoUrl) => updateItem(p.id, { photoUrl })} maxDim={256} />
            </Field>
            <Field label="Short description">
              <Textarea rows={2} value={p.blurb || ""} onChange={(e) => updateItem(p.id, { blurb: e.target.value })} />
            </Field>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        icon={Plus}
        className="justify-self-start"
        onClick={() => setItems([...items, { id: uid("person"), name: "", role: "", photoUrl: "", blurb: "" }])}
      >
        Add person
      </Button>
    </div>
  );
}

function BodyEditor({ block, update }) {
  return (
    <div className="mt-3">
      <Field label="Body">
        <Textarea value={block.body || ""} onChange={(e) => update({ body: e.target.value })} />
      </Field>
    </div>
  );
}

const EDITORS = {
  links: LinksEditor,
  image: ImageEditor,
  video: VideoEditor,
  embed: EmbedEditor,
  columns: ColumnsEditor,
  spotlight: SpotlightEditor,
};

/*
 * Edits a page's `config.blocks` array. `value` is the blocks array; `onChange`
 * receives the next array. Pure/controlled, the parent persists via mutate.
 */
function BlockEditor({ value = [], onChange }) {
  const blocks = value;

  const update = (id, patch) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id) => onChange(blocks.filter((b) => b.id !== id));
  const move = (id, dir) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type) => onChange([...blocks, emptyBlock(type)]);

  return (
    <div className="grid gap-3">
      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-slate-400">
          This page is empty. Blocks are the building pieces of a page, pick one below to
          get started. Hover any button to see what it adds.
        </p>
      )}
      {blocks.map((block, idx) => {
        const TypeEditor = EDITORS[block.type] || BodyEditor;
        return (
          <div key={block.id} className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {BLOCK_TYPES.find((t) => t.value === block.type)?.label || block.type}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => move(block.id, -1)} className="disabled:opacity-30" />
                <IconButton icon={ChevronDown} label="Move down" disabled={idx === blocks.length - 1} onClick={() => move(block.id, 1)} className="disabled:opacity-30" />
                <IconButton icon={Trash2} label="Delete block" onClick={() => remove(block.id)} className="hover:border-red-500/40 hover:text-red-300" />
              </div>
            </div>

            <Field label="Title" hint={block.type === "image" ? "Optional heading above the image." : undefined}>
              <Input value={block.title || ""} onChange={(e) => update(block.id, { title: e.target.value })} />
            </Field>

            <TypeEditor block={block} update={(patch) => update(block.id, patch)} />
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BLOCK_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              title={t.desc}
              onClick={() => add(t.value)}
              className="press flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:border-[color:var(--color-border-strong)] hover:text-white"
            >
              <Icon size={14} className="shrink-0 text-[var(--color-primary)]" />
              <span className="min-w-0">
                <span className="block truncate">{t.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Memoized: typing in the page label/hero fields leaves the blocks array
// untouched, so the whole editor can skip those re-renders.
export default memo(BlockEditor);
