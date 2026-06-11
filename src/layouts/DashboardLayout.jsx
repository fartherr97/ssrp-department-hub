import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import Logo from "../components/common/Logo.jsx";
import { BrandName, useMounted } from "../components/common/index.jsx";
import { getIcon } from "../lib/icons.js";
import { buildNav } from "../lib/navigation.js";
import { userAvatar, userDisplayName, userRoleLabel } from "../lib/user.js";

// ─── Account chip (top-right) ────────────────────────────────────────────────

function AccountMenu({ user, config, open, setOpen, onLogout }) {
  const role = userRoleLabel(user, config);
  // Keep the menu mounted briefly after close so its exit animation plays.
  const mounted = useMounted(open, 140);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`press flex items-center gap-2.5 rounded-full border bg-[var(--color-surface-2)] py-1 pl-1 pr-2.5 transition ${
          open
            ? "border-[color:var(--color-border-strong)]"
            : "border-white/10 hover:border-[color:var(--color-border)]"
        }`}
      >
        <img
          src={userAvatar(user)}
          className="h-8 w-8 rounded-full border border-white/10 object-cover"
          alt={userDisplayName(user)}
        />
        <div className="hidden min-w-0 text-left sm:block">
          <div className="max-w-[160px] truncate text-sm font-semibold leading-tight text-white">
            {userDisplayName(user)}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            {role}
          </div>
        </div>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {mounted && (
        <div
          className={`hub-menu hub-menu-floating absolute right-0 top-full z-50 mt-2 min-w-[230px] p-2 ${
            open ? "anim-dropdown-in" : "anim-dropdown-out pointer-events-none"
          }`}
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold text-white">{userDisplayName(user)}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              {role}
            </div>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <button onClick={onLogout} className="hub-menu-item hub-menu-item-danger">
            <LogOut size={16} strokeWidth={2.4} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── A single page link inside a dropdown / mobile panel ─────────────────────

function PageItem({ page, active, onNavigate }) {
  const Icon = getIcon(page.icon);
  return (
    <button
      onClick={() => onNavigate(page.id)}
      className={`press group/navitem flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${
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
                className={`press hub-nav-link px-3 text-sm font-semibold transition-colors ${
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
          <div
            key={group.name}
            className="relative flex h-16 items-center"
            onMouseEnter={() => setOpenGroup(group.name)}
            onMouseLeave={() => setOpenGroup((g) => (g === group.name ? null : g))}
          >
            <button
              onClick={() => setOpenGroup(open ? null : group.name)}
              className={`press hub-nav-link gap-1.5 px-3 text-sm font-semibold transition-colors ${
                open || containsActive
                  ? "hub-nav-link-active text-[var(--color-primary)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {group.name}
              <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              // The pt-2 wrapper keeps the gap hoverable so the menu doesn't
              // close while the cursor crosses from the trigger to the panel.
              <div className="absolute left-0 top-full z-50 pt-2">
                <div className="hub-menu hub-menu-floating anim-dropdown-in grid min-w-[250px] gap-1 p-2.5">
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
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Mobile dropdown panel ───────────────────────────────────────────────────

function MobileNav({ nav, activePage, onNavigate, open }) {
  return (
    <div
      className={`hub-panel absolute left-3 right-3 top-full z-50 mt-2 max-h-[70vh] space-y-4 overflow-y-auto rounded-2xl p-4 lg:hidden ${
        open ? "anim-mobilenav-in" : "anim-mobilenav-out pointer-events-none"
      }`}
    >
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
  const [accountOpen, setAccountOpen] = useState(false);
  // Keep the mobile nav mounted briefly after close so its exit animation plays.
  const mobileNavMounted = useMounted(mobileOpen, 180);
  const nav = buildNav(config, user);
  const branding = config?.branding || {};
  const dropdownGroups = config?.dropdownGroups || [];
  const anyMenuOpen = mobileOpen || openGroup !== null || accountOpen;

  const closeAll = () => {
    setMobileOpen(false);
    setOpenGroup(null);
    setAccountOpen(false);
  };

  // Close menus on Escape.
  useEffect(() => {
    if (!anyMenuOpen) return;
    const onKey = (e) => e.key === "Escape" && closeAll();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anyMenuOpen]);

  function navigate(pageId) {
    onNavigate(pageId);
    closeAll();
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
              setAccountOpen(false);
            }}
            className="press rounded-xl border border-white/10 bg-[var(--color-surface-1)] p-2 text-slate-200 transition hover:border-[color:var(--color-border)] lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand */}
          <button
            onClick={() => nav[0]?.pages[0] && navigate(nav[0].pages[0].id)}
            className="press flex shrink-0 items-center gap-3"
          >
            <Logo branding={branding} size={40} />
            <div className="hidden min-w-0 text-left sm:block">
              <div className="truncate text-[1.05rem] font-semibold leading-tight text-white">
                <BrandName
                  text={branding.shortName || branding.name || ""}
                  accent={branding.brandAccent}
                />
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
            <AccountMenu
              user={user}
              config={config}
              open={accountOpen}
              setOpen={(v) => {
                setOpenGroup(null);
                setMobileOpen(false);
                setAccountOpen(v);
              }}
              onLogout={onLogout}
            />
          </div>

          {mobileNavMounted && (
            <MobileNav
              nav={nav}
              activePage={activePage}
              onNavigate={navigate}
              open={mobileOpen}
            />
          )}
        </div>
      </header>

      {/* Click-away backdrop closes any open menu */}
      {anyMenuOpen && (
        <button
          aria-label="Close menu"
          onClick={closeAll}
          className="anim-fade-in fixed inset-0 z-[60] cursor-default bg-black/40 lg:bg-transparent"
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
