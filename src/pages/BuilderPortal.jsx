import { useState } from "react";
import { Palette, LayoutList, Users, Lock, Database, Check } from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { PageHeader } from "../components/common/index.jsx";
import BrandingTab from "./builder/BrandingTab.jsx";
import PagesTab from "./builder/PagesTab.jsx";
import RosterTab from "./builder/RosterTab.jsx";
import AccessTab from "./builder/AccessTab.jsx";
import AdvancedTab from "./builder/AdvancedTab.jsx";

const TABS = [
  { id: "branding", label: "Branding", icon: Palette, Component: BrandingTab },
  { id: "pages", label: "Pages & Nav", icon: LayoutList, Component: PagesTab },
  { id: "roster", label: "Roster Schema", icon: Users, Component: RosterTab },
  { id: "access", label: "Access & Roles", icon: Lock, Component: AccessTab },
  { id: "advanced", label: "Advanced", icon: Database, Component: AdvancedTab },
];

export default function BuilderPortal() {
  const { saving } = useConfig();
  const [tab, setTab] = useState("branding");
  const Active = TABS.find((t) => t.id === tab)?.Component || BrandingTab;

  return (
    <div>
      <PageHeader
        kicker="Administration"
        title="Builder Portal"
        subtitle="Configure your department hub. Every change saves automatically."
        actions={
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
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex gap-2 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "border border-[color:var(--color-border-strong)] bg-[color:var(--color-primary)]/12 text-white"
                    : "border border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} className={active ? "text-[var(--color-primary)]" : "text-slate-500"} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <Active />
        </div>
      </div>
    </div>
  );
}
