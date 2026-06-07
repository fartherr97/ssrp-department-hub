import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import Logo from "../components/common/Logo.jsx";
import { getIcon } from "../lib/icons.js";
import { buildNav } from "../lib/navigation.js";
import { userAvatar, userRoleLabel } from "../lib/user.js";

// ─── Account chip (top-right) ────────────────────────────────────────────────

function AccountChip({ user, config, onLogout }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={userAvatar(user)}
        className="h-9 w-9 rounded-full border border-white/10 object-cover"
        alt={user.username}
      />
      <div className="hidden min-w-0 sm:block">
        <div className="max-w-[160px] truncate text-sm font-semibold leading-tight text-white">
          {user.username}
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          {userRoleLabel(user, config)}
        </div>
      </div>
      <button
        onClick={onLogout}
        title="Sign out"
        className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2 text-slate-400 transition hover:border-[color:var(--color-border-strong)] hover:text-white"
      >
        <LogOut size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// ─── A single page link inside a dropdown / mobile panel ─────────────────────

function PageItem({ page, active, onNavigate }) {
  const Icon = getIcon(page.icon);
  return (
    <button
      onClick={() => onNavigate(page.id)}
      className={`group/navitem flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${
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
}

// ─── Desktop top-bar nav (grouped dropdown menus) ────────────────────────────

function TopNav({ nav, activePage, dropdownGroups, openGroup, setOpenGroup, onNavigate }) {
  return (
    <nav className="hidden h-16 items-center gap-1 lg:flex">
      {nav.map((group) => {
        const asDropdown = dropdownGroups.includes(group.name);

        // Inline group: render each page as a top-bar link with the swipe underline.
        if (!asDropdown) {
          return group.pages.map((page) => {
            const active = page.id === activePage;
            return (
              <button
                key={page.id}
                onClick={() => onNavigate(page.id)}
                className={`hub-nav-link px-3 text-sm font-semibold transition-colors ${
                  active ? "hub-nav-link-active text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {page.label}
              </button>
            );
          });
        }

        // Dropdown group: a single labelled menu (e.g. "Rank Access ⌄").
        const containsActive = group.pages.some((p) => p.id === activePage);
        const open = openGroup === group.name;
        return (
          <div key={group.name} className="relative flex h-16 items-center">
            <button
              onClick={() => setOpenGroup(open ? null : group.name)}
              className={`hub-nav-link gap-1.5 px-3 text-sm font-semibold transition-colors ${
                open || containsActive
                  ? "hub-nav-link-active text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {group.name}
              <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="hub-menu absolute left-0 top-full z-50 grid min-w-[240px] gap-0.5 p-2">
                {group.pages.map((page) => {
                  const active = page.id === activePage;
                  return (
                    <button
                      key={page.id}
                      onClick={() => onNavigate(page.id)}
                      className={active ? "hub-menu-item hub-menu-item-active" : "hub-menu-item"}
                    >
                      {page.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Mobile dropdown panel ───────────────────────────────────────────────────

function MobileNav({ nav, activePage, onNavigate }) {
  return (
    <div className="hub-panel absolute left-3 right-3 top-full z-50 mt-2 max-h-[70vh] space-y-4 overflow-y-auto rounded-2xl p-4 lg:hidden">
      {nav.map((group) => (
        <section key={group.name}>
          <div className="hub-nav-group mb-1.5 px-2 text-[11px] font-black uppercase tracking-[0.2em]">
            {group.name}
          </div>
          <div className="grid gap-1">
            {group.pages.map((page) => (
              <PageItem
                key={page.id}
                page={page}
                active={page.id === activePage}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

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
  const [openGroup, setOpenGroup] = useState(null);
  const nav = buildNav(config, user);
  const branding = config?.branding || {};
  const dropdownGroups = config?.dropdownGroups || [];
  const anyMenuOpen = mobileOpen || openGroup !== null;

  // Close menus on Escape.
  useEffect(() => {
    if (!anyMenuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setOpenGroup(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anyMenuOpen]);

  function navigate(pageId) {
    onNavigate(pageId);
    setMobileOpen(false);
    setOpenGroup(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-body-bg)] text-white">
      <div className="hub-shell-gradient fixed inset-0" />

      <header className="sticky top-0 z-[70] border-b border-white/10 bg-[color:var(--color-bg)]/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-[1680px] items-center gap-4 px-4 sm:px-6">
          {/* Mobile menu toggle */}
          <button
            onClick={() => {
              setMobileOpen((p) => !p);
              setOpenGroup(null);
            }}
            className="rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-2 text-slate-200 transition hover:border-[color:var(--color-border)] lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand */}
          <button
            onClick={() => nav[0]?.pages[0] && navigate(nav[0].pages[0].id)}
            className="flex shrink-0 items-center gap-3"
          >
            <Logo branding={branding} size={40} />
            <div className="hidden min-w-0 text-left sm:block">
              <div className="truncate text-[1.05rem] font-semibold leading-tight text-white">
                {branding.shortName || branding.name}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {branding.organization}
              </div>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="ml-2 hidden flex-1 lg:flex">
            <TopNav
              nav={nav}
              activePage={activePage}
              dropdownGroups={dropdownGroups}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              onNavigate={navigate}
            />
          </div>

          {/* Mobile active label (center) */}
          <div className="min-w-0 flex-1 text-center lg:hidden">
            <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
              {activeLabel}
            </div>
          </div>

          {/* Account */}
          <div className="shrink-0">
            <AccountChip user={user} config={config} onLogout={onLogout} />
          </div>

          {mobileOpen && (
            <MobileNav nav={nav} activePage={activePage} onNavigate={navigate} />
          )}
        </div>
      </header>

      {/* Click-away backdrop closes any open menu */}
      {anyMenuOpen && (
        <button
          aria-label="Close menu"
          onClick={() => {
            setMobileOpen(false);
            setOpenGroup(null);
          }}
          className="fixed inset-0 z-[60] cursor-default bg-black/40 lg:bg-transparent"
        />
      )}

      <main className="relative z-10">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div
            key={activePage}
            className="animate-pageFade mx-auto min-h-[calc(100vh-9rem)] w-full max-w-[1560px]"
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
