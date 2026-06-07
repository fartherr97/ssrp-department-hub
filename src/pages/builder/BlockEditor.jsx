import { Plus, Trash2, ChevronUp, ChevronDown, Type, Info, Link2 } from "lucide-react";
import {
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Select,
} from "../../components/common/index.jsx";
import { uid } from "../../lib/roster.js";

const BLOCK_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "callout", label: "Callout", icon: Info },
  { value: "links", label: "Link list", icon: Link2 },
];

/*
 * Edits a page's `config.blocks` array. `value` is the blocks array; `onChange`
 * receives the next array. Pure/controlled — the parent persists via mutate.
 */
export default function BlockEditor({ value = [], onChange }) {
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
  const add = (type) => {
    const base = { id: uid("block"), type, title: "" };
    onChange([...blocks, type === "links" ? { ...base, items: [] } : { ...base, body: "" }]);
  };

  // link item helpers
  const setItems = (blockId, items) => update(blockId, { items });

  return (
    <div className="grid gap-3">
      {blocks.map((block, idx) => (
        <div key={block.id} className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-white/5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {block.type}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => move(block.id, -1)} className="disabled:opacity-30" />
              <IconButton icon={ChevronDown} label="Move down" disabled={idx === blocks.length - 1} onClick={() => move(block.id, 1)} className="disabled:opacity-30" />
              <IconButton icon={Trash2} label="Delete block" onClick={() => remove(block.id)} className="hover:border-red-500/40 hover:text-red-300" />
            </div>
          </div>

          <Field label="Title">
            <Input value={block.title || ""} onChange={(e) => update(block.id, { title: e.target.value })} />
          </Field>

          {block.type === "links" ? (
            <div className="mt-3 grid gap-2">
              {(block.items || []).map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Label"
                    value={item.label}
                    onChange={(e) =>
                      setItems(
                        block.id,
                        block.items.map((it) => (it.id === item.id ? { ...it, label: e.target.value } : it))
                      )
                    }
                  />
                  <Input
                    placeholder="https://…"
                    value={item.url}
                    onChange={(e) =>
                      setItems(
                        block.id,
                        block.items.map((it) => (it.id === item.id ? { ...it, url: e.target.value } : it))
                      )
                    }
                  />
                  <IconButton
                    icon={Trash2}
                    label="Remove link"
                    onClick={() => setItems(block.id, block.items.filter((it) => it.id !== item.id))}
                    className="hover:border-red-500/40 hover:text-red-300"
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                icon={Plus}
                className="justify-self-start"
                onClick={() => setItems(block.id, [...(block.items || []), { id: uid("link"), label: "", url: "" }])}
              >
                Add link
              </Button>
            </div>
          ) : (
            <div className="mt-3">
              <Field label="Body">
                <Textarea value={block.body || ""} onChange={(e) => update(block.id, { body: e.target.value })} />
              </Field>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((t) => (
          <Button key={t.value} variant="secondary" icon={t.icon} onClick={() => add(t.value)}>
            Add {t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
