import { useMemo, useState } from "react";
import Logo from "../common/Logo.jsx";
import { BrandName, Select } from "../common/index.jsx";
import { getIcon } from "../../lib/icons.js";
import { safeLinkUrl, safeMediaUrl } from "../../lib/urls.js";
import * as api from "../../lib/api.js";

// ─── Loading ─────────────────────────────────────────────────────────────────

// A single, calm department-style loading screen: the brand logo (only when a
// real one is set — never a placeholder initial, which used to flash a "D"
// before the config loaded) above a spinning circle.
export function LoadingScreen({ branding }) {
  const logo = safeMediaUrl(branding?.logoUrl);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-body-bg)] text-white">
      <div className="flex flex-col items-center gap-5">
        {logo && (
          <img
            src={logo}
            alt=""
            className="h-14 w-14 rounded-xl object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <span
          className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[var(--color-primary)]"
          aria-hidden="true"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
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

// ─── Dev / preview login (no Discord) ────────────────────────────────────────

// Shown instead of the Discord button when the server has DEV_LOGIN_ENABLED on.
// Pick a permission group and sign in without Discord — the backend only mints a
// session when dev login is enabled, and never grants more than that group would.
function DevLoginPanel({ config, onLogin }) {
  // Public config exposes groups as { id, label, level }. Offer them highest
  // level first, plus a plain "member", and default to the top group so you land
  // able to preview the Builder.
  const groups = useMemo(() => {
    const list = [...(config?.groups || [])].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    if (!list.some((g) => g.id === "member")) list.push({ id: "member", label: "Member" });
    return list;
  }, [config]);

  const [group, setGroup] = useState(groups[0]?.id || "member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enter() {
    setBusy(true);
    setError("");
    try {
      const user = await api.devLogin(group);
      onLogin?.(user);
    } catch (e) {
      setError(e?.message || "Dev login failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 w-full max-w-xs">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
        Preview mode
      </div>
      <div className="flex flex-col gap-2.5">
        <Select value={group} onChange={setGroup} name="dev-group">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label || g.id}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={enter}
          disabled={busy}
          className="btn-glossy inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-hover))] px-8 py-3 text-[15px] font-semibold leading-none text-white shadow-xl shadow-black/25 hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Enter preview"}
        </button>
      </div>
      {error && <div className="mt-2 text-[11px] text-rose-400">{error}</div>}
      <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">
        Discord login is off — signing in without Discord for preview/testing.
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

export function LoginScreen({ config, onLogin }) {
  const branding = config?.branding || {};
  const socials = branding.socials || [];
  // When the server has dev login enabled, show the preview picker and hide the
  // Discord button (see publicConfig / DEV_LOGIN_ENABLED).
  const devMode = !!config?.auth?.devLoginEnabled;

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

          {devMode ? (
            <DevLoginPanel config={config} onLogin={onLogin} />
          ) : (
            <>
              {/* Connect Discord, centered */}
              <DiscordButton className="mt-8" />
              <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                Connect with Discord to access the system
              </div>
            </>
          )}

          <SocialRow socials={socials} />
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
