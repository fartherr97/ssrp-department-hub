import { useState } from "react";
import { LogIn } from "lucide-react";
import Logo from "../common/Logo.jsx";
import { Button } from "../common/index.jsx";

// ─── Loading ─────────────────────────────────────────────────────────────────

export function LoadingScreen({ branding }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-body-bg)] text-white">
      <div className="flex flex-col items-center gap-4">
        <Logo branding={branding} size={56} className="animate-pulse" />
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Loading…
        </p>
      </div>
    </div>
  );
}

// ─── Discord OAuth button ────────────────────────────────────────────────────

function DiscordButton({ className = "" }) {
  return (
    <a
      href="/auth/discord"
      className={`${className} btn-glossy inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] px-8 py-3.5 text-[17px] font-semibold leading-none text-white shadow-xl shadow-black/25 hover:brightness-110`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.631 1.338A18.3 18.3 0 0 0 14.157 0c-.196.347-.425.815-.583 1.186a16.964 16.964 0 0 0-5.148 0A12.607 12.607 0 0 0 7.84 0a18.344 18.344 0 0 0-4.476 1.341C.482 5.392-.296 9.34.094 13.232c1.878 1.38 3.698 2.219 5.489 2.769a13.65 13.65 0 0 0 1.184-1.926 11.99 11.99 0 0 1-1.865-.896c.157-.114.31-.233.458-.355 3.593 1.658 7.5 1.658 11.053 0 .15.122.303.241.459.355-.594.352-1.225.653-1.867.898.337.679.72 1.325 1.184 1.925 1.793-.55 3.615-1.389 5.493-2.77.451-4.51-.777-8.42-3.051-11.894ZM7.348 10.83c-1.11 0-2.024-1.02-2.024-2.27 0-1.25.893-2.273 2.024-2.273 1.132 0 2.047 1.021 2.025 2.273.001 1.25-.893 2.27-2.025 2.27Zm7.303 0c-1.11 0-2.024-1.02-2.024-2.27 0-1.25.892-2.273 2.024-2.273 1.131 0 2.046 1.021 2.024 2.273 0 1.25-.893 2.27-2.024 2.27Z" />
      </svg>
      Connect Discord
    </a>
  );
}

// ─── Dev login (front-end only) ──────────────────────────────────────────────

function DevLogin({ groups, onDevLogin }) {
  const [group, setGroup] = useState(groups?.[groups.length - 1]?.id || "admin");
  return (
    <div className="mt-10 w-full max-w-sm rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-left">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300/80">
        Developer preview
      </div>
      <p className="mb-3 text-xs text-slate-400">
        No backend yet — preview the hub as any permission group. Replace with
        real Discord auth when the server is wired up.
      </p>
      <div className="flex gap-2">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-app-input px-3 py-2 text-sm text-cad-text outline-none transition focus:border-[color:var(--color-border-strong)]"
        >
          {groups?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <Button icon={LogIn} onClick={() => onDevLogin(group)}>
          Enter
        </Button>
      </div>
    </div>
  );
}

// ─── Login screen ────────────────────────────────────────────────────────────

export function LoginScreen({ config, onDevLogin }) {
  const branding = config?.branding || {};
  const devEnabled = config?.auth?.devLoginEnabled;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-body-bg)] text-white">
      <div className="hub-shell-gradient pointer-events-none absolute inset-0" />

      <header className="relative z-10 border-b border-white/10 bg-[color:var(--color-bg)]/80">
        <div className="mx-auto flex h-[82px] w-full max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Logo branding={branding} size={48} />
            <div>
              <div className="text-lg font-semibold leading-tight text-white">
                {branding.name}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {branding.organization}
              </div>
            </div>
          </div>
          <DiscordButton className="hidden sm:inline-flex" />
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-82px)] flex-col items-center justify-center px-5 py-14 text-center">
        <Logo branding={branding} size={120} className="drop-shadow-2xl" />

        <div className="mt-6 inline-flex rounded-full border border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary)]/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
          {branding.organization}
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl leading-[1] text-white sm:text-5xl lg:text-6xl">
          {branding.loginHeadline || branding.name}
        </h1>

        <p className="mt-5 max-w-2xl text-base font-normal leading-7 text-[var(--color-text-muted)] sm:text-lg">
          {branding.loginSubtext}
        </p>

        <DiscordButton className="mt-8" />

        {devEnabled && <DevLogin groups={config?.groups} onDevLogin={onDevLogin} />}

        <footer className="mt-20 text-center">
          <p className="text-sm text-slate-400">{branding.footerText}</p>
        </footer>
      </main>
    </div>
  );
}
