import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import Logo from "../components/common/Logo.jsx";
import { getIcon } from "../lib/icons.js";
import { buildNav } from "../lib/navigation.js";
import { userAvatar, userRoleLabel } from "../lib/user.js";

function AccountChip({ user, config, onLogout, compact = false }) {
  return (
    <div className={`hub-panel flex items-center gap-3 rounded-2xl px-3 py-2 ${compact ? "" : ""}`}>
      <img
        src={userAvatar(user)}
        className="h-10 w-10 rounded-full border border-white/10 object-cover"
        alt={user.username}
      />
      <div className="min-w-0 flex-1">
        <div className="max-w-[180px] truncate text-sm font-semibold text-white">
          {user.username}
        </div>
        <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          {userRoleLabel(user, config)}
        </div>
      </div>
      <button
        onClick={onLogout}
        title="Sign out"
        className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2 text-slate-400 transition hover:text-white"
      >
        <LogOut size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function SidebarNav({ nav, activePage, onNavigate }) {
  return (
    <nav className="space-y-6 px-3 pb-5">
      {nav.map((group) => (
        <section key={group.name}>
          <div className="hub-nav-group mb-2 px-3 text-[11px] font-black uppercase tracking-[0.2em]">
            {group.name}
          </div>
          <div>
            {group.pages.map((page) => {
              const Icon = getIcon(page.icon);
              const active = activePage === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => onNavigate(page.id)}
                  className={`group/navitem mb-1 flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium last:mb-0 ${
                    active ? "hub-nav-item-active" : "hub-nav-item"
                  }`}
                >
                  <Icon
                    size={16}
                    strokeWidth={2.35}
                    className={
                      active
                        ? "text-[var(--color-primary)]"
                        : "text-[#7f9ec8] transition-colors group-hover/navitem:text-[var(--color-primary)]"
                    }
                  />
                  <span className="truncate">{page.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export default function DashboardLayout({
  user,
  config,
  activePage,
  activeLabel,
  onNavigate,
  onLogout,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = buildNav(config, user);
  const branding = config?.branding || {};

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function navigate(pageId) {
    onNavigate(pageId);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-[var(--color-body-bg)] text-white">
      <div className="hub-shell-gradient fixed inset-0" />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-[70] flex h-16 items-center justify-between border-b border-white/10 bg-[color:var(--color-bg)]/95 px-4 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen((p) => !p)}
          className="rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-2 text-slate-200"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="min-w-0 px-3 text-center">
          <div className="truncate text-sm font-semibold text-white">{branding.name}</div>
          <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
            {activeLabel}
          </div>
        </div>
        <img
          src={userAvatar(user)}
          className="h-9 w-9 rounded-full border border-white/10 object-cover"
          alt={user.username}
        />
      </header>

      <div className="relative z-10 flex min-h-screen">
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          />
        )}

        <aside
          className={`fixed left-0 top-16 z-50 flex h-[calc(100dvh-4rem)] w-[min(88vw,340px)] flex-col border-r border-white/10 bg-[linear-gradient(180deg,var(--color-surface-1)_0%,var(--color-body-bg)_100%)] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-white/10 p-4">
            <Logo branding={branding} size={44} />
            <div className="min-w-0">
              <div className="truncate text-[1.15rem] font-semibold text-white">
                {branding.shortName || branding.name}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {branding.organization}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-4">
            <SidebarNav nav={nav} activePage={activePage} onNavigate={navigate} />
          </div>
          <div className="border-t border-white/10 p-3 lg:hidden">
            <AccountChip user={user} config={config} onLogout={onLogout} compact />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="hidden h-20 items-center justify-between border-b border-white/10 bg-[color:var(--color-bg)]/80 px-6 backdrop-blur lg:flex">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span>{branding.shortName || branding.name}</span>
              <ChevronRight size={15} />
              <span className="font-medium text-slate-300">{activeLabel}</span>
            </div>
            <AccountChip user={user} config={config} onLogout={onLogout} />
          </div>
          <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
            <div
              key={activePage}
              className="animate-pageFade mx-auto min-h-[calc(100vh-112px)] w-full max-w-[1560px]"
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
