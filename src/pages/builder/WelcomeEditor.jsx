import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Select,
  ColorInput,
  MediaInput,
} from "../../components/common/index.jsx";
import { uid } from "../../lib/roster.js";
import { useConfig } from "../../lib/configContext.jsx";

// A small on/off switch for the Section Visibility panel.
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
        checked
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]"
          : "border-white/15 bg-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

// Reusable reorderable list: rows keyed by id, with up/down/delete + an add
// button. `renderRow(item, patch)` renders the fields for one row.
function ListEditor({ items, onChange, addLabel, makeItem, renderRow }) {
  const set = (next) => onChange(next);
  const update = (id, patch) => set(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => set(items.filter((it) => it.id !== id));
  const move = (id, dir) => {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  return (
    <div className="grid gap-3">
      {items.map((it, idx) => (
        <div
          key={it.id}
          className="flex items-start gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
        >
          <div className="min-w-0 flex-1">{renderRow(it, (patch) => update(it.id, patch))}</div>
          <div className="flex flex-col gap-1">
            <IconButton icon={ChevronUp} label="Move up" disabled={idx === 0} onClick={() => move(it.id, -1)} className="disabled:opacity-30" />
            <IconButton icon={ChevronDown} label="Move down" disabled={idx === items.length - 1} onClick={() => move(it.id, 1)} className="disabled:opacity-30" />
            <IconButton icon={Trash2} label="Remove" onClick={() => remove(it.id)} className="hover:border-red-500/40 hover:text-red-300" />
          </div>
        </div>
      ))}
      <Button variant="ghost" icon={Plus} className="justify-self-start" onClick={() => set([...items, makeItem()])}>
        {addLabel}
      </Button>
    </div>
  );
}

const CDN_NOTE = (
  <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
    <div className="text-sm text-amber-200/90">
      <strong className="text-amber-200">Use a permanent image host.</strong> Discord CDN links
      expire and will silently break your page — upload images to your own CDN first.
    </div>
  </div>
);

const VISIBILITY = [
  { key: "about", label: "About / Description", hint: "Department overview text and quick stats." },
  { key: "commandStaff", label: "Command Staff", hint: "Roster of leadership members." },
  { key: "media", label: "Media Gallery", hint: "Rotating photo gallery for operations and media." },
  { key: "ticker", label: "Ticker / Notices", hint: "Scrolling announcement banner below the hero." },
  { key: "recruiting", label: "Recruiting Banner", hint: "Join the department section." },
  { key: "resources", label: "Resources & Links", hint: "External resource links." },
];

/*
 * The Builder editor for a "welcome" (department landing) page. `value` is the
 * page's config object; `setCfg(patch)` merges a shallow patch into it (the
 * PageModal owns the draft and persists on save).
 */
export default function WelcomeEditor({ value, setCfg }) {
  const { config } = useConfig();
  const cfg = value || {};
  const show = cfg.show || {};
  const setList = (key) => (next) => setCfg({ [key]: next });
  const chainPages = (config?.pages || []).filter((p) => p.type === "chain");
  const sourced = Boolean(cfg.commandSource);

  return (
    <div className="grid gap-5">
      {/* Identity */}
      <Panel className="p-5">
        <SectionHeader title="Identity" />
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full department name">
              <Input value={cfg.fullName || ""} onChange={(e) => setCfg({ fullName: e.target.value })} />
            </Field>
            <Field label="Short name / abbreviation">
              <Input value={cfg.shortName || ""} onChange={(e) => setCfg({ shortName: e.target.value })} />
            </Field>
          </div>
          <Field label="Kicker" hint="Small line above the title. Defaults to your hub name.">
            <Input value={cfg.kicker || ""} placeholder="Sunshine State Roleplay" onChange={(e) => setCfg({ kicker: e.target.value })} />
          </Field>
          <Field label="Motto / tagline">
            <Input value={cfg.motto || ""} onChange={(e) => setCfg({ motto: e.target.value })} />
          </Field>
          <Field label="About description">
            <Textarea rows={5} value={cfg.about || ""} onChange={(e) => setCfg({ about: e.target.value })} />
          </Field>
        </div>
      </Panel>

      {/* Branding */}
      <Panel className="p-5">
        <SectionHeader title="Branding" />
        {CDN_NOTE}
        <div className="grid gap-4">
          <Field label="Accent color" hint="Highlight color for this page (buttons, headings, accents).">
            <ColorInput value={cfg.accent || ""} onChange={(v) => setCfg({ accent: v })} />
          </Field>
          <Field label="Badge / logo URL" hint="Transparent PNG shown in the hero. ~400×400px.">
            <MediaInput value={cfg.badgeUrl} onChange={(url) => setCfg({ badgeUrl: url })} maxDim={512} />
          </Field>
          <Field label="Hero banner URL" hint="Background behind the hero. Images or MP4/WebM video.">
            <MediaInput kind="video" value={cfg.bannerUrl} onChange={(url) => setCfg({ bannerUrl: url })} placeholder="https://… image or video" />
          </Field>
        </div>
      </Panel>

      {/* Recruiting */}
      <Panel className="p-5">
        <SectionHeader title="Recruiting" />
        <div className="grid gap-4">
          <Field label="Recruitment form URL" hint="Where the Apply Now buttons link.">
            <Input value={cfg.recruitFormUrl || ""} placeholder="https://…" onChange={(e) => setCfg({ recruitFormUrl: e.target.value })} />
          </Field>
          <Field label="Recruiting description">
            <Textarea rows={3} value={cfg.recruitDescription || ""} onChange={(e) => setCfg({ recruitDescription: e.target.value })} />
          </Field>
        </div>
      </Panel>

      {/* Quick Stats */}
      <Panel className="p-5">
        <SectionHeader title="Quick Stats" subtitle="Numerical highlights shown in the About section." />
        <ListEditor
          items={cfg.stats || []}
          onChange={setList("stats")}
          addLabel="Add stat"
          makeItem={() => ({ id: uid("stat"), value: "", label: "" })}
          renderRow={(it, patch) => (
            <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
              <Field label="Value">
                <Input value={it.value} onChange={(e) => patch({ value: e.target.value })} />
              </Field>
              <Field label="Label">
                <Input value={it.label} onChange={(e) => patch({ label: e.target.value })} />
              </Field>
            </div>
          )}
        />
      </Panel>

      {/* Command Staff */}
      <Panel className="p-5">
        <SectionHeader title="Command Staff" subtitle="Leadership cards. Rank tier sets the card's color (gold / silver / blue)." />
        <div className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
          <Field label="Source" hint="Enter members by hand, or pull them live from a Chain of Command page.">
            <Select
              value={cfg.commandSource || ""}
              onChange={(e) => setCfg({ commandSource: e.target.value })}
            >
              <option value="">Manual entries</option>
              {chainPages.map((p) => (
                <option key={p.id} value={p.id}>
                  Chain of Command: {p.label}
                </option>
              ))}
            </Select>
          </Field>
          {sourced && (
            <Field label="Levels to include" hint="How many levels below the top box to show.">
              <Select value={String(cfg.commandLevels || 4)} onChange={(e) => setCfg({ commandLevels: Number(e.target.value) })}>
                <option value="2">Top 2 levels</option>
                <option value="3">Top 3 levels</option>
                <option value="4">Top 4 levels</option>
                <option value="5">Top 5 levels</option>
              </Select>
            </Field>
          )}
        </div>
        {sourced ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-400">
            Command staff is pulled live from the{" "}
            <strong className="text-white">
              {chainPages.find((p) => p.id === cfg.commandSource)?.label || "selected"}
            </strong>{" "}
            chain-of-command page — names, ranks, and photos come from there and stay in sync as you
            edit that chart. Switch back to <strong className="text-white">Manual entries</strong> to
            hand-manage the cards here instead.
          </p>
        ) : (
          <>
        {CDN_NOTE}
        <ListEditor
          items={cfg.commandStaff || []}
          onChange={setList("commandStaff")}
          addLabel="Add member"
          makeItem={() => ({ id: uid("staff"), name: "", rank: "", badge: "", callsign: "", avatarUrl: "", tier: "command" })}
          renderRow={(it, patch) => (
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={it.name} onChange={(e) => patch({ name: e.target.value })} />
                </Field>
                <Field label="Rank (e.g. Captain - Training)">
                  <Input value={it.rank} onChange={(e) => patch({ rank: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Badge #">
                  <Input value={it.badge} onChange={(e) => patch({ badge: e.target.value })} />
                </Field>
                <Field label="Callsign">
                  <Input value={it.callsign} onChange={(e) => patch({ callsign: e.target.value })} />
                </Field>
                <Field label="Rank tier">
                  <Select value={it.tier || "command"} onChange={(e) => patch({ tier: e.target.value })}>
                    <option value="command">Department Head (Gold)</option>
                    <option value="supervisor">Supervisor (Silver)</option>
                    <option value="officer">Officer (Blue)</option>
                  </Select>
                </Field>
              </div>
              <Field label="Avatar URL">
                <MediaInput value={it.avatarUrl} onChange={(url) => patch({ avatarUrl: url })} maxDim={256} />
              </Field>
            </div>
          )}
        />
          </>
        )}
      </Panel>

      {/* Media */}
      <Panel className="p-5">
        <SectionHeader title="Operations & Media" subtitle="Photos rotate automatically with a cinematic zoom. Landscape (16:9) works best." />
        {CDN_NOTE}
        <ListEditor
          items={cfg.media || []}
          onChange={setList("media")}
          addLabel="Add photo"
          makeItem={() => ({ id: uid("photo"), url: "", caption: "" })}
          renderRow={(it, patch) => (
            <div className="grid gap-2">
              <Field label="Photo URL">
                <MediaInput value={it.url} onChange={(url) => patch({ url })} maxDim={1600} />
              </Field>
              <Field label="Caption (optional)">
                <Input value={it.caption} onChange={(e) => patch({ caption: e.target.value })} />
              </Field>
            </div>
          )}
        />
      </Panel>

      {/* Ticker */}
      <Panel className="p-5">
        <SectionHeader title="Announcement Ticker" subtitle="Notices scroll across a banner below the hero. Keep them concise." />
        <ListEditor
          items={cfg.notices || []}
          onChange={setList("notices")}
          addLabel="Add announcement"
          makeItem={() => ({ id: uid("notice"), text: "", url: "" })}
          renderRow={(it, patch) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Announcement text">
                <Input value={it.text} onChange={(e) => patch({ text: e.target.value })} />
              </Field>
              <Field label="Link (optional)">
                <Input value={it.url} placeholder="https://…" onChange={(e) => patch({ url: e.target.value })} />
              </Field>
            </div>
          )}
        />
      </Panel>

      {/* Resources */}
      <Panel className="p-5">
        <SectionHeader title="Resource Links" subtitle="Icon options: Shield, Users, Star, Radio, LinkIcon, Bell, BookOpen, FileText." />
        <ListEditor
          items={cfg.resources || []}
          onChange={setList("resources")}
          addLabel="Add resource"
          makeItem={() => ({ id: uid("res"), title: "", url: "", description: "", icon: "LinkIcon" })}
          renderRow={(it, patch) => (
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Title">
                  <Input value={it.title} onChange={(e) => patch({ title: e.target.value })} />
                </Field>
                <Field label="URL">
                  <Input value={it.url} placeholder="https://…" onChange={(e) => patch({ url: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Description (optional)">
                  <Input value={it.description} onChange={(e) => patch({ description: e.target.value })} />
                </Field>
                <Field label="Icon name">
                  <Input value={it.icon} placeholder="LinkIcon" onChange={(e) => patch({ icon: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        />
      </Panel>

      {/* External links */}
      <Panel className="p-5">
        <SectionHeader title="External Links" />
        <Field label="Department Discord invite">
          <Input value={cfg.discordInvite || ""} placeholder="https://discord.com/invite/…" onChange={(e) => setCfg({ discordInvite: e.target.value })} />
        </Field>
      </Panel>

      {/* Section visibility */}
      <Panel className="p-5">
        <SectionHeader title="Section Visibility" subtitle="Toggle which sections show on the page." />
        <div className="grid gap-1">
          {VISIBILITY.map((s) => (
            <div key={s.key} className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{s.label}</div>
                <div className="text-xs text-slate-500">{s.hint}</div>
              </div>
              <Toggle
                checked={show[s.key] !== false}
                onChange={(v) => setCfg({ show: { ...show, [s.key]: v } })}
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
