import { useState } from "react";
import { Plus, Pencil, Trash2, Shirt, Lock } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canManageSite, canEditFleet } from "../lib/permissions.js";
import { uid } from "../lib/roster.js";
import {
  Button, IconButton, Panel, PageHeader, Modal, ConfirmDialog, Field, Input,
} from "../components/common/index.jsx";
import { UniformBoard } from "./UniformRoster.jsx";

/*
 * Subdivision Uniform Roster ("uniformtabs") — the same uniform board as the
 * plain Uniform Roster, but split into tabs (SWAT, TED, K9…). Site managers add
 * and configure tabs; each tab can name the groups (e.g. its subdivision heads)
 * allowed to edit it, on top of full roster editors and site managers.
 *   config: { tabs: [{ id, name, editGroups: [], outfits: [], notes }] }
 */

function newTab(name = "New Section") {
  return { id: uid("utab"), name, editGroups: [], outfits: [], notes: "" };
}

function TabSettingsModal({ open, onClose, tab, groups, onSave }) {
  const [draft, setDraft] = useState(tab);
  const sel = draft.editGroups || [];
  const toggle = (id) => setDraft((d) => ({ ...d, editGroups: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] }));
  return (
    <Modal open={open} onClose={onClose} title={`Tab settings — ${tab.name}`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!draft.name.trim()} onClick={() => onSave(draft)}>Save</Button></>}>
      <div className="grid gap-4">
        <Field label="Tab name" hint="e.g. SWAT Uniform Roster, TED, K9…">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Who can edit this tab" hint="On top of site managers and full roster editors — pick the subdivision's group(s).">
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => toggle(g.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${sel.includes(g.id) ? "border-[var(--color-primary)] bg-[color:var(--color-primary)]/15 text-white" : "border-white/15 text-slate-400 hover:text-white"}`}>
                {g.label}
              </button>
            ))}
            {groups.length === 0 && <span className="text-xs text-slate-500">No groups defined yet.</span>}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export default function SubdivisionUniforms({ page, user }) {
  const { config, mutate } = useConfig();
  const cfg = page?.config || {};
  const tabs = Array.isArray(cfg.tabs) ? cfg.tabs : [];
  const groups = config.groups || [];

  const canManageTabs = canManageSite(user, config); // add/rename/delete tabs, set edit groups
  const canEditTab = (tab) =>
    canManageSite(user, config) || canEditFleet(user, config) || (tab?.editGroups || []).includes(user?.group);

  const [active, setActive] = useState(tabs[0]?.id || null);
  const [settings, setSettings] = useState(null); // tab being configured
  const [confirmDel, setConfirmDel] = useState(null);
  const activeTab = tabs.find((t) => t.id === active) || tabs[0] || null;

  const setTabs = (next) =>
    mutate((c) => ({
      ...c,
      pages: c.pages.map((p) => (p.id === page.id ? { ...p, config: { ...(p.config || {}), tabs: next } } : p)),
    }));
  const patchTab = (id, patch) => setTabs(tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function addTab() {
    const t = newTab();
    setTabs([...tabs, t]);
    setActive(t.id);
    setSettings(t);
  }

  return (
    <div>
      <PageHeader
        kicker={cfg.heroKicker || "Personnel"}
        title={cfg.heroTitle || page?.label || "Subdivision Uniform Rosters"}
        subtitle={cfg.heroSubtitle || "Uniform rosters per subdivision. Each tab can be edited by its own subdivision heads."}
        actions={canManageTabs && tabs.length > 0 && <Button icon={Plus} onClick={addTab}>Add tab</Button>}
      />

      {tabs.length === 0 ? (
        <Panel className="p-10 text-center">
          <Shirt size={32} className="mx-auto mb-3 text-slate-500" />
          <div className="text-base font-semibold text-slate-200">No subdivision tabs yet</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Add a tab per subdivision (SWAT, TED, K9…). Each holds its own uniform roster and can be
            assigned to the groups allowed to edit it.
          </p>
          {canManageTabs && <Button icon={Plus} className="mt-4" onClick={addTab}>Add the first tab</Button>}
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            {tabs.map((t) => (
              <div key={t.id} className="flex items-center">
                <button
                  onClick={() => setActive(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    activeTab?.id === t.id ? "bg-[color:var(--color-primary)]/18 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t.name}
                  {!canEditTab(t) && <Lock size={11} className="text-slate-600" />}
                </button>
                {canManageTabs && activeTab?.id === t.id && (
                  <div className="ml-0.5 flex items-center">
                    <IconButton icon={Pencil} label="Tab settings" onClick={() => setSettings(t)} className="h-7 w-7" />
                    <IconButton icon={Trash2} label="Delete tab" onClick={() => setConfirmDel(t)} className="h-7 w-7 hover:border-red-500/40 hover:text-red-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {activeTab && (
            <>
              {!canEditTab(activeTab) && (
                <p className="mb-3 text-xs text-slate-500">You can view this tab but not edit it.</p>
              )}
              <UniformBoard
                key={activeTab.id}
                outfits={activeTab.outfits || []}
                setOutfits={(next) => patchTab(activeTab.id, { outfits: next })}
                canEdit={canEditTab(activeTab)}
                notes={activeTab.notes}
                setNotes={(next) => patchTab(activeTab.id, { notes: next })}
                notesLabel={`${activeTab.name} rules`}
                emptyHint={`Add the uniforms for ${activeTab.name} — a card per uniform with a reference photo and its component numbers and textures.`}
              />
            </>
          )}
        </>
      )}

      {settings && (
        <TabSettingsModal
          key={settings.id}
          open
          onClose={() => setSettings(null)}
          tab={settings}
          groups={groups}
          onSave={(draft) => { patchTab(draft.id, { name: draft.name.trim(), editGroups: draft.editGroups }); setSettings(null); }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmDel)}
        title="Delete this tab?"
        message={`Delete "${confirmDel?.name}" and all ${confirmDel?.outfits?.length || 0} of its uniforms?`}
        confirmLabel="Delete tab"
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          const next = tabs.filter((t) => t.id !== confirmDel.id);
          setTabs(next);
          if (active === confirmDel.id) setActive(next[0]?.id || null);
          setConfirmDel(null);
        }}
      />
    </div>
  );
}
