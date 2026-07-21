import { Check, ArrowRight, Palette, LayoutList, Users, Database, Shield, Save, Paintbrush, UserSquare2 } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import { defaultConfig } from "../../config/defaultConfig.js";
import { Panel, SectionHeader, Button } from "../../components/common/index.jsx";

/*
 * The Builder's landing tab, a plain-English guide for Department Heads with
 * no technical background. It explains what the Builder does, walks through a
 * setup checklist (auto-detected from the config), and points out the things
 * that are managed elsewhere (roster members, access groups).
 */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function buildChecklist(config) {
  const b = config.branding || {};
  const db = defaultConfig.branding;
  const homePage = config.pages.find((p) => p.id === "home");
  const defaultHome = defaultConfig.pages.find((p) => p.id === "home");

  return [
    {
      id: "name",
      label: "Name your department",
      detail: "Replace the placeholder name with your department's real name.",
      done: b.name !== db.name || b.shortName !== db.shortName,
      tab: "branding",
    },
    {
      id: "logo",
      label: "Add your logo",
      detail: "Paste a link to your department's logo image. Until then a generated monogram is shown.",
      done: Boolean(b.logoUrl),
      tab: "branding",
    },
    {
      id: "colors",
      label: "Pick your colors",
      detail: "Choose a one-click color preset or fine-tune each color yourself.",
      done: !same(b.colors, db.colors),
      tab: "branding",
    },
    {
      id: "home",
      label: "Write your Home page",
      detail: "Change the welcome text and add your own announcements and quick links.",
      done: !homePage || !same(homePage.config, defaultHome?.config),
      tab: "pages",
    },
    {
      id: "roster",
      label: "Set up your roster",
      detail: "Create your subdivisions (e.g. Patrol, K9) and choose which columns members have.",
      done: !same(config.roster, defaultConfig.roster),
      tab: "roster",
    },
    {
      id: "access",
      label: "Give your people access",
      detail: "Add members to permission groups so the right people can edit the right things.",
      done: (config.groups || []).some((g) => (g.members || []).length > 0),
      hint: "Found in the top bar under Administration → Access & Roles.",
    },
  ];
}

const TAB_GUIDE = [
  {
    icon: Palette,
    title: "Branding",
    body: "Your department's name, logo, colors, and the login screen people see before signing in.",
  },
  {
    icon: LayoutList,
    title: "Pages & Menu",
    body: "The pages in your hub and how they're arranged in the top navigation bar. Each page is built from simple blocks: text, notices, and link lists.",
  },
  {
    icon: Users,
    title: "Roster Setup",
    body: "The structure of your roster, subdivisions, member columns, and the stats box. The members themselves are added on the Roster page, not here.",
  },
  {
    icon: Database,
    title: "Backup & Restore",
    body: "Download a backup file of your whole setup at any time, and restore one to bring everything back exactly as it was.",
  },
];

const GOOD_TO_KNOW = [
  {
    icon: Save,
    title: "Everything saves by itself",
    body: "There is no Save button. Every change is stored automatically, watch for the green “All changes saved” badge at the top. Made a mistake? Restore any earlier version from Administration → Audit Log → Version history.",
  },
  {
    icon: Paintbrush,
    title: "Changes show up instantly",
    body: "Colors, names, and pages update live. Open another page of the hub after a change to see exactly what your members will see.",
  },
  {
    icon: UserSquare2,
    title: "Roster members live on the Roster page",
    body: "This Builder only shapes the roster (subdivisions and columns). To add ranks and people, go to the Roster page itself and edit there.",
  },
  {
    icon: Shield,
    title: "Who can do what",
    body: "Permissions are managed under Administration → Access & Roles. Only groups with “Manage site” can open this Builder.",
  },
];

export default function StartHereTab({ goTo }) {
  const { config } = useConfig();
  const items = buildChecklist(config);
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader
          title="Welcome to the Builder"
          subtitle="This is where you make the hub your own, no technical knowledge needed."
        />
        <p className="text-sm leading-relaxed text-slate-300">
          Everything your members see, the name, the colors, the pages, the roster, is
          controlled from the tabs on the left. Work through the checklist below in order
          and you'll have a fully branded department hub in a few minutes. You can't break
          anything: every step can be changed again later, and you can download a backup at
          any time from <span className="font-semibold text-white">Backup &amp; Restore</span>.
          Run into a word you don't know, like “hero kicker”? Look it up in the{" "}
          <button
            type="button"
            onClick={() => goTo?.("guide")}
            className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            Key Guide
          </button>
          .
        </p>
      </Panel>


      <Panel className="p-5">
        <SectionHeader
          title="Setup checklist"
          subtitle={`${doneCount} of ${items.length} steps done, finished steps are detected automatically.`}
        />
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] transition-all"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
        <div className="grid gap-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2.5"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  item.done
                    ? "bg-green-400/15 text-green-300"
                    : "bg-white/5 text-slate-400"
                }`}
              >
                {item.done ? <Check size={14} /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-semibold ${
                    item.done ? "text-slate-400 line-through decoration-slate-600" : "text-white"
                  }`}
                >
                  {item.label}
                </div>
                <div className="text-xs text-slate-500">{item.detail}</div>
                {item.hint && (
                  <div className="mt-0.5 text-xs font-semibold text-[var(--color-primary)]">
                    {item.hint}
                  </div>
                )}
              </div>
              {item.tab && (
                <Button
                  variant="secondary"
                  className="shrink-0 !px-3 !py-1.5 text-xs"
                  onClick={() => goTo?.(item.tab)}
                >
                  Open
                  <ArrowRight size={13} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="What each tab does" />
        <div className="grid gap-3 sm:grid-cols-2">
          {TAB_GUIDE.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.title}
                className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-4"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/12 text-[var(--color-primary)]">
                    <Icon size={15} />
                  </span>
                  <span className="text-sm font-bold text-white">{t.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{t.body}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Good to know" />
        <div className="grid gap-3 sm:grid-cols-2">
          {GOOD_TO_KNOW.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-300">
                  <Icon size={15} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">{t.title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
