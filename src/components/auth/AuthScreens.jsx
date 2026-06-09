import { useState } from "react";
import { LogIn } from "lucide-react";
import Logo from "../common/Logo.jsx";
import { Button } from "../common/index.jsx";
import { getIcon } from "../../lib/icons.js";

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

// ─── Community socials row ("Connect With Us") ───────────────────────────────

function SocialRow({ socials }) {
  if (!socials?.length) return null;
  return (
    <div className="mt-9 flex flex-col items-center gap-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Connect With Us
      </div>
      <div className="flex items-center gap-3">
        {socials.map((s, i) => {
          const Icon = getIcon(s.icon);
          return (
            <a
              key={s.id || s.url || i}
              href={s.url || "#"}
              target={s.url && s.url !== "#" ? "_blank" : undefined}
              rel="noreferrer"
              aria-label={s.label}
              title={s.label}
              className="lift flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--color-text-muted)] hover:border-[color:var(--color-border-strong)] hover:text-[var(--color-primary)]"
            >
              <Icon size={20} />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Login screen ────────────────────────────────────────────────────────────

export function LoginScreen({ config, onDevLogin }) {
  const branding = config?.branding || {};
  const devEnabled = config?.auth?.devLoginEnabled;
  const socials = branding.socials || [];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--color-body-bg)] text-white">
      <div className="hub-shell-gradient pointer-events-none absolute inset-0" />

      {/* ── Header bar ── */}
      <header className="relative z-10 flex h-[52px] shrink-0 items-center gap-4 border-b border-white/10 bg-app-toolbar/85 px-4 backdrop-blur-md sm:h-[60px] sm:px-8">
        <div className="flex items-center gap-3">
          <Logo branding={branding} size={36} />
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold tracking-[-0.2px] text-white sm:text-[15px]">
              {branding.shortName || branding.name}
            </div>
            {branding.organization && (
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)] sm:text-[10px]">
                {branding.organization}
              </div>
            )}
          </div>
        </div>
        <div className="ml-auto" />
      </header>

      {/* ── Main (centered) ── */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <Logo branding={branding} size={104} className="mb-5 drop-shadow-2xl" />

          {branding.organization && (
            <div className="mb-5 inline-flex rounded-full border border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary)]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              {branding.organization}
            </div>
          )}

          <h1 className="text-3xl font-bold leading-[1.1] text-white sm:text-4xl">
            {branding.loginHeadline || branding.name}
          </h1>

          {branding.loginSubtext && (
            <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--color-text-muted)]">
              {branding.loginSubtext}
            </p>
          )}

          {/* Connect Discord — centered */}
          <DiscordButton className="mt-8" />
          <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">
            Connect with Discord to access the system
          </div>

          <SocialRow socials={socials} />

          {devEnabled && <DevLogin groups={config?.groups} onDevLogin={onDevLogin} />}
        </div>
      </main>

      {/* ── Footer bar ── */}
      <footer className="relative z-10 w-full shrink-0 border-t border-white/10 bg-app-toolbar/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo branding={branding} size={20} className="opacity-70" />
            <span className="text-[11px] text-slate-500">{branding.footerText}</span>
          </div>
          {branding.footerNote && (
            <div className="ml-auto hidden text-[10.5px] font-medium text-slate-600 md:block">
              {branding.footerNote}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
