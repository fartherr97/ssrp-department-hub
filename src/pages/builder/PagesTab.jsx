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
import TabIntro from "./TabIntro.jsx";
import BlockRenderer from "../../components/content/BlockRenderer.jsx";

// ─── Page editor modal ───────────────────────────────────────────────────────

// A live, non-interactive rendering of the page as it's being edited, so
// people see the result without saving and navigating away.
function PagePreview({ draft }) {
  const cfg = draft.config || {};
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-body-bg)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
          Live preview
        </span>
        <span className="text-[11px] text-slate-600">updates as you type</span>
      </div>
      <div className="pointer-events-none select-none">
        {cfg.heroKicker && <div className="hub-kicker">{cfg.heroKicker}</div>}
        <h2 className="mt-1 text-xl font-bold text-white">{cfg.heroTitle || draft.label}</h2>
        {cfg.heroSubtitle && (
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{cfg.heroSubtitle}</p>
        )}
        <div className="mt-4">
          <BlockRenderer blocks={cfg.blocks || []} />
          {(cfg.blocks || []).length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">
              Blocks you add will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PageModal({ open, onClose, config, page, onSave }) {
  const [draft, setDraft] = useState(page);
  const [iconQuery, setIconQuery] = useState("");
  if (open && draft.id !== page.id) setDraft(page);

  const visibleIcons = ICON_NAMES.filter((n) =>
    n.toLowerCase().includes(iconQuery.trim().toLowerCase())
  );

  const isContentLike = draft.type === "content" || draft.type === "home";
  const cfg = draft.config || {};
  const setCfg = (patch) => setDraft((d) => ({ ...d, config: { ...(d.config || {}), ...patch } }));

  // Per-group visibility (content pages only; system pages have their own rules).
  const access = Array.isArray(draft.access) ? draft.access : [];
  const toggleGroup = (groupId) =>
    setDraft((d) => {
      const set = new Set(Array.isArray(d.access) ? d.access : []);
      set.has(groupId) ? set.delete(groupId) : set.add(groupId);
      return { ...d, access: [...set] };
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={page.isNew ? "Add page" : `Edit “${page.label}”`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save page</Button>
        </>
      }
    >
      <div className={`grid gap-5 ${isContentLike ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]" : ""}`}>
      <div className="grid content-start gap-5">
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

        <Field label="Icon" hint="Shown next to the page name in the navigation menu.">
          <Input
            value={iconQuery}
            placeholder="Search icons…"
            onChange={(e) => setIconQuery(e.target.value)}
            className="mb-2"
          />
          <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2">
            {visibleIcons.length === 0 && (
              <p className="col-span-8 py-2 text-center text-xs text-slate-500">
                No icons match “{iconQuery}”.
              </p>
            )}
            {visibleIcons.map((name) => {
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

        {isContentLike && (
          <Field label="Who can see this page">
            <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!draft.restricted}
                  onChange={(e) => setDraft({ ...draft, restricted: !e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Everyone who is signed in
              </label>
              {draft.restricted && (
                <div className="ml-6 grid gap-1.5">
                  <p className="text-xs text-slate-500">
                    Only these groups can see the page (site managers always can):
                  </p>
                  {config.groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={access.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      {g.label}
                    </label>
                  ))}
                  {draft.restricted && access.length === 0 && (
                    <p className="text-xs text-amber-300">
                      No groups selected — only site managers will see this page.
                    </p>
                  )}
                </div>
              )}
            </div>
          </Field>
        )}

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
            Roster page itself; manage roster columns under the “Roster Setup” tab.
          </p>
        )}
      </div>

      {isContentLike && (
        <div className="hidden min-w-0 lg:block">
          <PagePreview draft={draft} />
        </div>
      )}
      </div>
    </Modal>
  );
}

// ─── Nav groups manager ──────────────────────────────────────────────────────

function NavGroups() {
  const { config, mutate } = useConfig();
  const [name, setName] = useState("");
  const dropdownGroups = config.dropdownGroups || [];

  function add() {
    const trimmed = name.trim();
    if (!trimmed || config.navGroups.includes(trimmed)) return;
    mutate((cfg) => ({ ...cfg, navGroups: [...cfg.navGroups, trimmed] }));
    setName("");
  }
  function remove(group) {
    // Don't orphan pages: only allow removing empty groups.
    if (config.pages.some((p) => p.navGroup === group)) return;
    mutate((cfg) => ({
      ...cfg,
      navGroups: cfg.navGroups.filter((g) => g !== group),
      dropdownGroups: (cfg.dropdownGroups || []).filter((g) => g !== group),
    }));
  }
  function setMode(group, asDropdown) {
    mutate((cfg) => {
      const set = new Set(cfg.dropdownGroups || []);
      asDropdown ? set.add(group) : set.delete(group);
      return { ...cfg, dropdownGroups: [...set] };
    });
  }
  function move(group, dir) {
    mutate((cfg) => {
      const arr = [...cfg.navGroups];
      const i = arr.indexOf(group);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= arr.length) return cfg;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...cfg, navGroups: arr };
    });
  }

  return (
    <Panel className="p-5">
      <SectionHeader
        title="Navigation groups"
        subtitle="The headings in the top bar, in this exact order — use the arrows to rearrange them. A group only appears once it contains at least one page. Inline groups show each page as a top-bar link; dropdown groups collapse into a menu."
      />
      <div className="grid gap-2">
        {config.navGroups.map((g, idx) => {
          const used = config.pages.some((p) => p.navGroup === g);
          const isDropdown = dropdownGroups.includes(g);
          return (
            <div
              key={g}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2"
            >
              <span className="flex-1 truncate text-sm font-semibold text-white">{g}</span>
              {!used && (
                <span
                  className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                  title="Empty groups are hidden from the top bar until a page is added to them"
                >
                  empty — not shown yet
                </span>
              )}
              <div className="flex overflow-hidden rounded-lg border border-white/10">
                {[
                  ["Inline", false],
                  ["Dropdown", true],
                ].map(([label, val]) => (
                  <button
                    key={label}
                    onClick={() => setMode(g, val)}
                    className={`px-3 py-1 text-xs font-semibold transition ${
                      isDropdown === val
                        ? "bg-[color:var(--color-primary)]/20 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  icon={ChevronUp}
                  label="Move left in the top bar"
                  disabled={idx === 0}
                  onClick={() => move(g, -1)}
                  className="disabled:opacity-30"
                />
                <IconButton
                  icon={ChevronDown}
                  label="Move right in the top bar"
                  disabled={idx === config.navGroups.length - 1}
                  onClick={() => move(g, 1)}
                  className="disabled:opacity-30"
                />
              </div>
              <button
                onClick={() => remove(g)}
                disabled={used}
                title={used ? "This group still contains pages — move or delete them first" : "Remove group"}
                className="text-slate-500 transition hover:text-red-300 disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            </div>
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
      restricted: false,
      access: config.groups.map((g) => g.id),
      config: { heroTitle: "New Page", blocks: [] },
      isNew: true,
    });
  }

  return (
    <div className="grid gap-6">
      <TabIntro>
        This tab controls the <strong className="text-white">pages</strong> in your hub and
        the <strong className="text-white">top navigation bar</strong>. First arrange your
        navigation groups (the headings in the top bar), then add pages into them. Click the
        pencil on any page to edit its title, icon, and content.
      </TabIntro>

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
                    {page.restricted && (
                      <span className="text-amber-300/80"> · restricted</span>
                    )}
                  </div>
                </div>
                <Badge>{page.locked ? "system" : page.type}</Badge>
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
