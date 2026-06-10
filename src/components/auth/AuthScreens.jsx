import { useState } from "react";
import { LogIn } from "lucide-react";
import Logo from "../common/Logo.jsx";
import { Button, BrandName } from "../common/index.jsx";
import { getIcon } from "../../lib/icons.js";
import { safeLinkUrl } from "../../lib/urls.js";

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
      <svg width="22" height="17" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true">
        <path d="M60.1 4.9A58.5 58.5 0 0045.8 1a40 40 0 00-1.8 3.7 54.1 54.1 0 00-16.1 0A40.3 40.3 0 0026.1 1 58.6 58.6 0 0011.8 4.9C1.7 19.7-1 34.1.3 48.3A59 59 0 0018 55.5a44.3 44.3 0 003.8-6.2 38.3 38.3 0 01-6-2.9l1.4-1.1a42.1 42.1 0 0036.2 0l1.5 1.1a38.1 38.1 0 01-6 2.9 44.6 44.6 0 003.8 6.2 58.7 58.7 0 0018.1-7.2C72 34 68.7 19.7 60.1 4.9zM23.7 39.8c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1c3.5 0 6.4 3.2 6.3 7.1 0 3.9-2.8 7.1-6.3 7.1zm23.6 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1c3.5 0 6.4 3.2 6.3 7.1 0 3.9-2.8 7.1-6.3 7.1z" />
      </svg>
      Connect Discord
    </a>
  );
}

// ─── Dev login (front-end only) ──────────────────────────────────────────────

function DevLogin({ groups, onDevLogin }) {
  // "Regular member" previews someone in no permission group at all —
  // they can view member pages but edit nothing.
  const options = [
    ...(groups || []),
    { id: "viewer", label: "Regular member (view only)" },
  ];
  const [group, setGroup] = useState(groups?.[groups.length - 1]?.id || "viewer");
  return (
    <div className="mt-10 w-full max-w-sm rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-left">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300/80">
        Developer preview
      </div>
      <p className="mb-3 text-xs text-slate-400">
        No backend yet, preview the hub as any permission group, or as a
        regular member with view-only access. Replace with real Discord auth
        when the server is wired up.
      </p>
      <div className="flex gap-2">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-app-input px-3 py-2 text-sm text-cad-text outline-none transition focus:border-[color:var(--color-border-strong)]"
        >
          {options.map((g) => (
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
              href={safeLinkUrl(s.url)}
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
              <BrandName
                text={branding.shortName || branding.name || ""}
                accent={branding.brandAccent}
              />
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
          <Logo branding={branding} size={104} className="mb-5 animate-float drop-shadow-2xl" />

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

          {/* Connect Discord, centered */}
          <DiscordButton className="mt-8" />
          <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">
            Connect with Discord to access the system
          </div>

          <SocialRow socials={socials} />

          {devEnabled && <DevLogin groups={config?.groups} onDevLogin={onDevLogin} />}
        </div>
      </main>

      {/* ── Footer bar: fixed SSRP network branding, not department-editable ── */}
      <footer className="relative z-10 w-full shrink-0 border-t border-white/10 bg-app-toolbar/80 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} <BrandName text="Sunshine State RP" accent="RP" />
            . All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
