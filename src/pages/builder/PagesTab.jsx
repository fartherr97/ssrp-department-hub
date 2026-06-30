import { memo, useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Lock, GripVertical } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import { getIcon, ICON_NAMES } from "../../lib/icons.js";
import { pageSlug, isGeneratedPageId } from "../../lib/navigation.js";
import { uid } from "../../lib/roster.js";
import { defaultLogBooks } from "../AdminLog.jsx";
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
  useModalData,
} from "../../components/common/index.jsx";
import BlockEditor from "./BlockEditor.jsx";
import TabIntro from "./TabIntro.jsx";
import BlockRenderer from "../../components/content/BlockRenderer.jsx";

// ─── Page editor modal ───────────────────────────────────────────────────────

// A live, non-interactive rendering of the page as it's being edited, so
// people see the result without saving and navigating away. Memoized and fed
// a debounced draft so typing isn't slowed by re-rendering the whole page.
const PagePreview = memo(function PagePreview({ draft }) {
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
});

// The searchable icon grid, memoized so typing in other fields doesn't
// re-render ~30 icon buttons on every keystroke.
const IconGrid = memo(function IconGrid({ selected, query, onPick }) {
  const visible = ICON_NAMES.filter((n) =>
    n.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2">
      {visible.length === 0 && (
        <p className="col-span-8 py-2 text-center text-xs text-slate-500">
          No icons match “{query}”.
        </p>
      )}
      {visible.map((name) => {
        const Icon = getIcon(name);
        const active = selected === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
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
  );
});

function PageModal({ open, onClose, config, page, onSave }) {
  const [draft, setDraft] = useState(page);
  const [iconQuery, setIconQuery] = useState("");
  if (open && draft.id !== page.id) setDraft(page);

  // Debounce the live preview so it re-renders after a pause, not per keystroke.
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const id = setTimeout(() => setPreviewDraft(draft), 150);
    return () => clearTimeout(id);
  }, [draft]);

  const isContentLike = draft.type === "content" || draft.type === "home";
  const cfg = draft.config || {};
  const setCfg = (patch) => setDraft((d) => ({ ...d, config: { ...(d.config || {}), ...patch } }));
  // Stable callbacks so the memoized icon grid / block editor skip re-renders.
  const pickIcon = useCallback((icon) => setDraft((d) => ({ ...d, icon })), []);
  const onBlocksChange = useCallback(
    (blocks) => setDraft((d) => ({ ...d, config: { ...(d.config || {}), blocks } })),
    []
  );

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

        {page.isNew && (
          <Field
            label="Page type"
            hint="Content = blocks you arrange here. Vehicle roster and Calendar are managed on the page itself."
          >
            <Select
              value={draft.type}
              onChange={(e) => {
                const type = e.target.value;
                const base =
                  type === "fleet"
                    ? { tiers: [], notes: "" }
                    : type === "uniforms"
                    ? { outfits: [], notes: "" }
                    : type === "chain"
                    ? { root: null, notes: "" }
                    : type === "adminlog"
                    ? { books: defaultLogBooks(), entries: [] }
                    : type === "calendar"
                    ? { events: [] }
                    : type === "activity"
                    ? { categories: ["roster", "calendar", "pages"] }
                    : type === "hours"
                    ? { topN: 10 }
                    : { heroTitle: draft.label || "New Page", blocks: [] };
                setDraft({ ...draft, type, config: base });
              }}
            >
              <option value="content">Content page (blocks)</option>
              <option value="fleet">Vehicle roster (fleet structure)</option>
              <option value="uniforms">Uniform roster (class structure)</option>
              <option value="chain">Chain of command (org chart)</option>
              <option value="adminlog">Administrative log (logbooks + stats)</option>
              <option value="calendar">Department calendar</option>
              <option value="activity">Activity feed (recent changes)</option>
              <option value="hours">Duty hours + leaderboard</option>
            </Select>
          </Field>
        )}

        {["fleet", "calendar", "uniforms", "chain", "adminlog", "activity", "hours"].includes(draft.type) && (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-400">
            {draft.type === "hours"
              ? "On-duty hours from the Duty Hub: a weekly top-hours leaderboard plus a table of every member's week/month hours and strikes. Hours sync from the Duty Hub (backend); strikes are counted from the admin logs. Viewable by anyone you allow below."
              : draft.type === "activity"
              ? "A read-only feed of recent department changes (roster moves, calendar events, new pages), drawn from the audit log so members don't have to re-check pages. Viewable by anyone you allow below."
              : draft.type === "fleet"
              ? "Vehicle roster pages are built on the page itself: add a column per rank or unit, then the vehicles each may use. Editing requires the “Edit main roster” capability."
              : draft.type === "uniforms"
              ? "Uniform roster pages are built on the page itself: a card per uniform with a reference photo and its component numbers/textures. Editing requires the “Edit main roster” capability."
              : draft.type === "chain"
              ? "Chain of command pages are built on the page itself: start with the top position, then click boxes to add the ranks below them. Editing requires the “Edit main roster” capability."
              : draft.type === "adminlog"
              ? "Comes preset with Admin Log, FTO, Interview, and Booth logbooks (fully editable). Logging requires the “Write administrative logs” capability; restrict who can VIEW it below."
              : "Calendar events are added on the page itself. Adding/editing events requires the “Manage calendar” capability (Command and up by default); anyone can mark attendance."}
          </p>
        )}

        <Field label="Icon" hint="Shown next to the page name in the navigation menu.">
          <Input
            value={iconQuery}
            placeholder="Search icons…"
            onChange={(e) => setIconQuery(e.target.value)}
            className="mb-2"
          />
          <IconGrid selected={draft.icon} query={iconQuery} onPick={pickIcon} />
        </Field>

        {/* Any custom page type can be restricted to chosen groups. */}
        {["content", "home", "fleet", "uniforms", "chain", "calendar", "adminlog", "activity", "hours"].includes(draft.type) && (
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
                      No groups selected, only site managers will see this page.
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
              <BlockEditor value={cfg.blocks || []} onChange={onBlocksChange} />
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
          <PagePreview draft={previewDraft} />
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
  const [confirmDel, setConfirmDel] = useState(null);
  const dropdownGroups = config.dropdownGroups || [];

  function add() {
    const trimmed = name.trim();
    if (!trimmed || config.navGroups.includes(trimmed)) return;
    mutate((cfg) => ({ ...cfg, navGroups: [...cfg.navGroups, trimmed] }));
    setName("");
  }
  function remove(group) {
    mutate((cfg) => {
      const remaining = cfg.navGroups.filter((g) => g !== group);
      if (remaining.length === 0) return cfg; // keep at least one group
      const fallback = remaining[0];
      return {
        ...cfg,
        navGroups: remaining,
        dropdownGroups: (cfg.dropdownGroups || []).filter((g) => g !== group),
        // Move any pages out of the deleted group so nothing is orphaned. To
        // remove a page entirely, delete it in the Pages list below.
        pages: cfg.pages.map((p) => (p.navGroup === group ? { ...p, navGroup: fallback } : p)),
      };
    });
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
        subtitle="The headings in the top bar, in this exact order, use the arrows to rearrange them. A group only appears once it contains at least one page. Inline groups show each page as a top-bar link; dropdown groups collapse into a menu."
      />
      <div className="grid gap-2">
        {config.navGroups.map((g, idx) => {
          const used = config.pages.some((p) => p.navGroup === g);
          const isDropdown = dropdownGroups.includes(g);
          return (
            <div
              key={g}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2"
            >
              <span className="min-w-[120px] flex-1 truncate text-sm font-semibold text-white">{g}</span>
              {!used && (
                <span
                  className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                  title="Empty groups are hidden from the top bar until a page is added to them"
                >
                  empty, not shown yet
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
                onClick={() => {
                  if (config.navGroups.length <= 1) return;
                  const count = config.pages.filter((p) => p.navGroup === g).length;
                  if (count > 0) setConfirmDel({ group: g, count });
                  else remove(g);
                }}
                disabled={config.navGroups.length <= 1}
                title={
                  config.navGroups.length <= 1
                    ? "You need at least one navigation group"
                    : "Remove group"
                }
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

      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Remove this navigation group?"
        message={`"${confirmDel?.group}" still has ${confirmDel?.count} ${
          confirmDel?.count === 1 ? "page" : "pages"
        }. Removing the group moves ${
          confirmDel?.count === 1 ? "it" : "them"
        } to "${config.navGroups.filter((g) => g !== confirmDel?.group)[0]}" — nothing is deleted. To remove a page entirely, delete it in the Pages list below.`}
        confirmLabel="Remove group"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          remove(confirmDel.group);
          setConfirmDel(null);
        }}
      />
    </Panel>
  );
}

// ─── Pages tab ───────────────────────────────────────────────────────────────

export default function PagesTab() {
  const { config, mutate } = useConfig();
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const editingM = useModalData(editing);

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
    mutate((cfg) => {
      // Page ids are the URL path, so derive a readable slug from the label
      // (new pages always; older random "page-xxxx" ids upgrade on save).
      const page = { ...clean };
      if (isNew || isGeneratedPageId(page.id)) {
        const taken = cfg.pages.filter((p) => p.id !== clean.id).map((p) => p.id);
        page.id = pageSlug(page.label, taken);
      }
      return {
        ...cfg,
        pages: isNew
          ? [...cfg.pages, page]
          : cfg.pages.map((p) => (p.id === clean.id ? page : p)),
      };
    });
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
                <Badge className="hidden sm:inline-flex">{page.locked ? "system" : page.type}</Badge>
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

      {editingM.data && (
        <PageModal
          key={editingM.key}
          open={editingM.open}
          onClose={() => setEditing(null)}
          config={config}
          page={editingM.data}
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
