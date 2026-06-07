import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Lock, GripVertical } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import { getIcon, ICON_NAMES } from "../../lib/icons.js";
import { uid } from "../../lib/roster.js";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Select,
  Badge,
} from "../../components/common/index.jsx";
import BlockEditor from "./BlockEditor.jsx";

// ─── Page editor modal ───────────────────────────────────────────────────────

function PageModal({ open, onClose, config, page, onSave }) {
  const [draft, setDraft] = useState(page);
  if (open && draft.id !== page.id) setDraft(page);

  const isContentLike = draft.type === "content" || draft.type === "home";
  const cfg = draft.config || {};
  const setCfg = (patch) => setDraft((d) => ({ ...d, config: { ...(d.config || {}), ...patch } }));

  function toggleAccess(groupId) {
    const access = new Set(draft.access || []);
    access.has(groupId) ? access.delete(groupId) : access.add(groupId);
    setDraft({ ...draft, access: [...access] });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={page.isNew ? "Add page" : `Edit “${page.label}”`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save page</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label">
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Nav group">
            <Select
              value={draft.navGroup}
              onChange={(e) => setDraft({ ...draft, navGroup: e.target.value })}
            >
              {config.navGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Icon">
          <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2">
            {ICON_NAMES.map((name) => {
              const Icon = getIcon(name);
              const active = draft.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDraft({ ...draft, icon: name })}
                  className={`flex h-9 items-center justify-center rounded-lg transition ${
                    active
                      ? "bg-[color:var(--color-primary)]/20 text-[var(--color-primary)] ring-1 ring-[color:var(--color-border-strong)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                  title={name}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Who can view this page?">
          <div className="flex flex-wrap gap-2">
            {config.groups.map((g) => {
              const on = (draft.access || []).includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleAccess(g.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    on
                      ? "border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/15 text-white"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          <span className="mt-1 block text-xs text-slate-500">
            Administrators always have access.
          </span>
        </Field>

        {isContentLike && (
          <div>
            <div className="mb-3 grid gap-4 sm:grid-cols-2">
              <Field label="Hero kicker">
                <Input value={cfg.heroKicker || ""} onChange={(e) => setCfg({ heroKicker: e.target.value })} />
              </Field>
              <Field label="Hero title">
                <Input value={cfg.heroTitle || ""} onChange={(e) => setCfg({ heroTitle: e.target.value })} />
              </Field>
            </div>
            <Field label="Hero subtitle">
              <Input value={cfg.heroSubtitle || ""} onChange={(e) => setCfg({ heroSubtitle: e.target.value })} />
            </Field>

            <div className="mt-4">
              <SectionHeader title="Content blocks" />
              <BlockEditor value={cfg.blocks || []} onChange={(blocks) => setCfg({ blocks })} />
            </div>
          </div>
        )}

        {draft.type === "roster" && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-400">
            This is the Roster page. Add ranks, members, and columns from the
            Roster page itself; manage roster columns under the “Roster Schema” tab.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ─── Nav groups manager ──────────────────────────────────────────────────────

function NavGroups() {
  const { config, mutate } = useConfig();
  const [name, setName] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed || config.navGroups.includes(trimmed)) return;
    mutate((cfg) => ({ ...cfg, navGroups: [...cfg.navGroups, trimmed] }));
    setName("");
  }
  function remove(group) {
    // Don't orphan pages: only allow removing empty groups.
    if (config.pages.some((p) => p.navGroup === group)) return;
    mutate((cfg) => ({ ...cfg, navGroups: cfg.navGroups.filter((g) => g !== group) }));
  }

  return (
    <Panel className="p-5">
      <SectionHeader title="Navigation groups" subtitle="Section headers in the sidebar." />
      <div className="flex flex-wrap gap-2">
        {config.navGroups.map((g) => {
          const used = config.pages.some((p) => p.navGroup === g);
          return (
            <span
              key={g}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[var(--color-surface-2)] px-3 py-1 text-sm text-slate-200"
            >
              {g}
              <button
                onClick={() => remove(g)}
                disabled={used}
                title={used ? "Group has pages" : "Remove group"}
                className="text-slate-500 transition hover:text-red-300 disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex max-w-sm gap-2">
        <Input
          value={name}
          placeholder="New group name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button icon={Plus} onClick={add}>
          Add
        </Button>
      </div>
    </Panel>
  );
}

// ─── Pages tab ───────────────────────────────────────────────────────────────

export default function PagesTab() {
  const { config, mutate } = useConfig();
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  function movePage(id, dir) {
    mutate((cfg) => {
      const pages = [...cfg.pages];
      const i = pages.findIndex((p) => p.id === id);
      const j = i + dir;
      if (j < 0 || j >= pages.length) return cfg;
      [pages[i], pages[j]] = [pages[j], pages[i]];
      return { ...cfg, pages };
    });
  }

  function savePage(draft) {
    const { isNew, ...clean } = draft;
    mutate((cfg) => ({
      ...cfg,
      pages: isNew
        ? [...cfg.pages, clean]
        : cfg.pages.map((p) => (p.id === clean.id ? clean : p)),
    }));
    setEditing(null);
  }

  function addPage() {
    setEditing({
      id: uid("page"),
      label: "New Page",
      navGroup: config.navGroups[0] || "Main",
      icon: "FileText",
      type: "content",
      access: config.groups.map((g) => g.id),
      config: { heroTitle: "New Page", blocks: [] },
      isNew: true,
    });
  }

  return (
    <div className="grid gap-6">
      <NavGroups />

      <Panel className="p-5">
        <SectionHeader
          title="Pages"
          subtitle="Add, reorder, and configure the pages in your hub."
          actions={
            <Button icon={Plus} onClick={addPage}>
              Add page
            </Button>
          }
        />
        <div className="grid gap-2">
          {config.pages.map((page, idx) => {
            const Icon = getIcon(page.icon);
            return (
              <div
                key={page.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5"
              >
                <GripVertical size={15} className="text-slate-600" />
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[var(--color-primary)]">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{page.label}</span>
                    {page.locked && (
                      <Lock size={12} className="text-slate-500" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {page.navGroup} · {page.type}
                  </div>
                </div>
                <Badge>{page.locked ? "system" : `${(page.access || []).length} group(s)`}</Badge>
                <div className="flex items-center gap-1">
                  <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => movePage(page.id, -1)} className="disabled:opacity-30" />
                  <IconButton icon={ChevronDown} label="Move down" disabled={idx === config.pages.length - 1} onClick={() => movePage(page.id, 1)} className="disabled:opacity-30" />
                  <IconButton icon={Pencil} label="Edit page" onClick={() => setEditing(page)} />
                  <IconButton
                    icon={Trash2}
                    label="Delete page"
                    disabled={page.locked}
                    onClick={() => setConfirm(page)}
                    className="hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {editing && (
        <PageModal
          open
          onClose={() => setEditing(null)}
          config={config}
          page={editing}
          onSave={savePage}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete page?"
        message={`Delete "${confirm?.label}"? This can't be undone.`}
        confirmLabel="Delete page"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          mutate((cfg) => ({ ...cfg, pages: cfg.pages.filter((p) => p.id !== confirm.id) }));
          setConfirm(null);
        }}
      />
    </div>
  );
}
