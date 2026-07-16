import { useEffect, useState } from "react";
import { Palette, LayoutList, Users, Database, Check, Compass, Undo2, BookOpen, Webhook } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { canManageSite } from "../lib/permissions.js";
import { getSubPagePath, buildSubPath } from "../lib/navigation.js";
import { PageHeader, Button } from "../components/common/index.jsx";
import StartHereTab from "./builder/StartHereTab.jsx";
import BrandingTab from "./builder/BrandingTab.jsx";
import PagesTab from "./builder/PagesTab.jsx";
import RosterTab from "./builder/RosterTab.jsx";
import AdvancedTab from "./builder/AdvancedTab.jsx";
import KeyGuideTab from "./builder/KeyGuideTab.jsx";
import WebhooksTab from "./builder/WebhooksTab.jsx";

// All Builder tabs are site configuration, they require the manageSite
// capability. Access & Roles lives on its own page under Administration.
const TABS = [
  { id: "start", label: "Start Here", desc: "Guide & setup checklist", icon: Compass, Component: StartHereTab },
  { id: "branding", label: "Branding", desc: "Name, logo & colors", icon: Palette, Component: BrandingTab },
  { id: "pages", label: "Pages & Menu", desc: "Pages & navigation bar", icon: LayoutList, Component: PagesTab },
  { id: "roster", label: "Roster Setup", desc: "Subdivisions & columns", icon: Users, Component: RosterTab },
  { id: "webhooks", label: "Webhooks", desc: "Promotion-vote Discord webhook", icon: Webhook, Component: WebhooksTab },
  { id: "advanced", label: "Backup & Restore", desc: "Save or restore everything", icon: Database, Component: AdvancedTab },
  { id: "guide", label: "Key Guide", desc: "Every term, in plain words", icon: BookOpen, Component: KeyGuideTab },
];

export default function BuilderPortal({ user, page }) {
  const { config, saving, undo, canUndo } = useConfig();
  const allowed = canManageSite(user, config);
  const tabs = allowed ? TABS : [];
  // Tabs are routable: /builder/branding, /builder/pages, …
  const [tab, setTab] = useState(() => {
    const fromUrl = getSubPagePath();
    return tabs.some((t) => t.id === fromUrl) ? fromUrl : tabs[0]?.id;
  });
  const active = tabs.find((t) => t.id === tab) || tabs[0];
  const Active = active?.Component;
  const pageId = page?.id || "builder";

  function selectTab(id) {
    setTab(id);
    window.history.pushState(null, "", buildSubPath(pageId, id));
  }

  // Back/forward between tabs.
  useEffect(() => {
    const onPop = () => {
      const fromUrl = getSubPagePath();
      setTab(TABS.some((t) => t.id === fromUrl) ? fromUrl : TABS[0].id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div>
      <PageHeader
        kicker="Administration"
        title="Builder Portal"
        subtitle="Customize your department hub, new here? Open the Start Here tab. Every change saves automatically."
        actions={
          <>
          <Button
            variant="secondary"
            icon={Undo2}
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? "Revert the most recent change" : "Nothing to undo yet"}
          >
            Undo
          </Button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              saving
                ? "bg-amber-400/10 text-amber-300"
                : "bg-green-400/10 text-green-300"
            }`}
          >
            <Check size={14} />
            {saving ? "Saving…" : "All changes saved"}
          </span>
          </>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-2 overflow-x-auto lg:w-60 lg:flex-col lg:overflow-visible">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`press flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                  isActive
                    ? "border border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/12 text-white"
                    : "border border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? "text-[var(--color-primary)]" : "text-slate-500"}`} />
                <span className="min-w-0">
                  <span className="block truncate">{t.label}</span>
                  <span className="hidden truncate text-[11px] font-medium text-slate-500 lg:block">
                    {t.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {Active && (
            <div key={active.id} className="animate-pageFade">
              <Active user={user} goTo={selectTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
