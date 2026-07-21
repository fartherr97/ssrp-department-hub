import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useConfig } from "../lib/configContext.jsx";
import { getIcon } from "../lib/icons.js";
import { safeLinkUrl, safeMediaUrl } from "../lib/urls.js";
import { commandStaffFromChain } from "../lib/chain.js";

// The Discord wordmark glyph (lucide has no brand icon), for the Discord button.
function DiscordIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 127.14 96.36" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

/*
 * WelcomePage — a preset "department landing page" page type. It renders a
 * full-bleed hero, an announcement ticker, an about + quick-stats block, a
 * command-staff roster, a rotating media gallery, a resources grid, and a
 * recruiting call-to-action. Everything is driven by page.config and edited in
 * the Builder Portal (WelcomeEditor). Sections can be individually toggled.
 */

// Tier → accent used on command-staff cards. Rank color is automatic.
const TIERS = {
  command: { label: "Department Head (Gold)", color: "#eab308" },
  supervisor: { label: "Supervisor (Silver)", color: "#cbd5e1" },
  officer: { label: "Officer (Blue)", color: "#3b82f6" },
};

// "Rank - Assignment" → { rank, sub } so cards can stack them (same idea as the
// Chain of Command boxes).
function splitTitle(title = "") {
  const m = title.match(/^(.*?)\s[-–—]\s(.+)$/);
  if (m) return { rank: m[1].trim(), sub: m[2].trim() };
  return { rank: title.trim(), sub: "" };
}

function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

function SectionHeading({ children }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-black tracking-tight text-white">{children}</h2>
      <div className="mt-2 h-1 w-14 rounded-full" style={{ background: "var(--wel)" }} />
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ cfg, kicker }) {
  const banner = safeMediaUrl(cfg.bannerUrl);
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(cfg.bannerUrl || "");
  const applyUrl = safeLinkUrl(cfg.recruitFormUrl);
  const discordUrl = safeLinkUrl(cfg.discordInvite);
  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-0">
        {banner && isVideo ? (
          <video src={banner} autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : banner ? (
          <img src={banner} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[var(--color-surface-2)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-body-bg)] via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[460px] max-w-[1400px] items-center px-6 py-16 sm:px-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {cfg.badgeUrl && safeMediaUrl(cfg.badgeUrl) && (
            <div className="relative shrink-0">
              {/* Soft glow behind the badge, tinted with the page accent. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
                style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--wel) 55%, transparent), transparent 72%)" }}
              />
              <img
                src={safeMediaUrl(cfg.badgeUrl)}
                alt={cfg.fullName || "Badge"}
                className="relative h-32 w-32 object-contain sm:h-44 sm:w-44"
                style={{ filter: "drop-shadow(0 0 20px rgba(0,0,0,0.55))" }}
              />
            </div>
          )}
          <div className="min-w-0">
            {kicker && (
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-slate-300">
                <span className="h-px w-6" style={{ background: "var(--wel)" }} />
                {kicker}
              </div>
            )}
            <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
              {cfg.fullName || "Department Name"}
            </h1>
            {cfg.motto && (
              <p
                className="mt-3 border-l-2 pl-3 text-lg italic text-slate-300"
                style={{ borderColor: "var(--wel)" }}
              >
                “{cfg.motto}”
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              {applyUrl && (
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="press lift-slow inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black shadow-lg transition hover:brightness-110"
                  style={{ background: "var(--wel)" }}
                >
                  <Users size={17} />
                  Apply Now
                </a>
              )}
              {discordUrl && (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="press lift-slow inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  <DiscordIcon size={18} />
                  Department Discord
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

function TickerItem({ n }) {
  const url = safeLinkUrl(n.url);
  const body = (
    <span className="mx-6 inline-flex items-center gap-2 text-sm text-slate-300">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--wel)" }} />
      {n.text}
    </span>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="hover:text-white">
      {body}
    </a>
  ) : (
    body
  );
}

function Ticker({ notices }) {
  const list = (notices || []).filter((n) => n.text?.trim());
  const maskRef = useRef(null);
  const unitRef = useRef(null);
  // Repeat the notice sequence enough times that one half of the track always
  // overflows the screen — otherwise short content leaves a gap and the loop
  // visibly snaps back to the left instead of flowing in from the right.
  const [reps, setReps] = useState(2);
  const [duration, setDuration] = useState(16);

  const key = list.map((n) => n.text).join("|");
  useLayoutEffect(() => {
    const mask = maskRef.current;
    const unit = unitRef.current;
    if (!mask || !unit) return undefined;
    const measure = () => {
      const unitW = unit.getBoundingClientRect().width;
      if (!unitW) return;
      const need = Math.max(1, Math.ceil(mask.clientWidth / unitW) + 1);
      setReps(need);
      // Constant speed regardless of how many repeats — one half scrolls past at
      // ~230px/s (brisk).
      setDuration(Math.max(6, (need * unitW) / 230));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(mask);
    return () => ro.disconnect();
  }, [key]);

  if (!list.length) return null;

  const Seq = ({ innerRef }) => (
    <span ref={innerRef} className="ticker-unit">
      {list.map((n, i) => (
        <TickerItem key={i} n={n} />
      ))}
    </span>
  );
  const Half = ({ withRef }) => (
    <div className="ticker-half">
      {Array.from({ length: reps }).map((_, r) => (
        <Seq key={r} innerRef={withRef && r === 0 ? unitRef : undefined} />
      ))}
    </div>
  );

  return (
    <div
      ref={maskRef}
      className="ticker-mask relative w-full overflow-hidden border-y border-white/10 bg-black/40 py-2.5"
    >
      <div className="ticker-track" style={{ "--ticker-duration": `${duration}s` }}>
        <Half withRef />
        <Half />
      </div>
    </div>
  );
}

// ─── About + stats ──────────────────────────────────────────────────────────

function About({ cfg }) {
  const stats = (cfg.stats || []).filter((s) => s.value || s.label);
  return (
    <section>
      <SectionHeading>About the Department</SectionHeading>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <p className="whitespace-pre-line text-[15px] leading-8 text-[var(--color-text-muted)]">
          {cfg.about || "Add a description of your department in the Builder Portal."}
        </p>
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 self-start">
            {stats.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-white/10 bg-[var(--color-surface-2)] p-4 text-center"
              >
                <div className="text-3xl font-black" style={{ color: "var(--wel)" }}>
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Command staff ────────────────────────────────────────────────────────────

function StaffCard({ m }) {
  const tier = TIERS[m.tier] || TIERS.officer;
  const { rank, sub } = splitTitle(m.rank || "");
  const avatar = safeMediaUrl(m.avatarUrl);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-surface-2)] text-center">
      <div className="h-1.5 w-full" style={{ background: tier.color }} />
      <div className="p-4">
        {avatar ? (
          <img
            src={avatar}
            alt={m.name}
            className="mx-auto h-20 w-20 rounded-full border-2 object-cover"
            style={{ borderColor: tier.color }}
          />
        ) : (
          <span
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 text-lg font-black text-white"
            style={{ borderColor: tier.color, background: `${tier.color}22` }}
          >
            {initials(m.name)}
          </span>
        )}
        <div className="mt-3 text-[11px] font-bold uppercase leading-tight tracking-wide" style={{ color: tier.color }}>
          {rank || "—"}
        </div>
        {sub && (
          <div className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
            {sub}
          </div>
        )}
        <div className="mt-1 text-base font-bold text-white">{m.name || "Unnamed"}</div>
        {(m.callsign || m.badge) && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-mono text-slate-400">
            {m.callsign && <span>{m.callsign}</span>}
            {m.badge && <span className="text-slate-500">#{m.badge}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function CommandStaff({ staff }) {
  if (!staff.length) return null;
  return (
    <section>
      <SectionHeading>Command Staff</SectionHeading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((m) => (
          <StaffCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}

// ─── Media gallery ────────────────────────────────────────────────────────────

function Gallery({ cfg }) {
  const photos = (cfg.media || []).filter((m) => safeMediaUrl(m.url));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % photos.length), 6000);
    return () => clearInterval(t);
  }, [photos.length]);
  if (!photos.length) return null;
  const idx = i % photos.length;
  const cur = photos[idx];
  const go = (d) => setI((n) => (n + d + photos.length) % photos.length);
  return (
    <section>
      <SectionHeading>Operations &amp; Media</SectionHeading>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="aspect-video w-full overflow-hidden">
          <img
            key={idx}
            src={safeMediaUrl(cur.url)}
            alt={cur.caption || ""}
            className="ken-burns h-full w-full object-cover"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {cur.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-sm font-semibold text-white">
            {cur.caption}
          </div>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="press absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="press absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-2 text-white backdrop-blur hover:bg-black/70"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((_, d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={`Go to photo ${d + 1}`}
                  onClick={() => setI(d)}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: d === idx ? 20 : 8,
                    background: d === idx ? "var(--wel)" : "rgba(255,255,255,0.4)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Resources ────────────────────────────────────────────────────────────────

function Resources({ cfg }) {
  const links = (cfg.resources || []).filter((r) => r.title);
  if (!links.length) return null;
  return (
    <section>
      <SectionHeading>Resources &amp; Links</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((r) => {
          const Icon = getIcon(r.icon);
          const url = safeLinkUrl(r.url);
          return (
            <a
              key={r.id}
              href={url}
              target={url && url !== "#" ? "_blank" : undefined}
              rel="noreferrer"
              className="lift group flex items-start gap-3 rounded-2xl border border-white/10 bg-[var(--color-surface-2)] p-4 hover:border-[color:var(--color-border-strong)]"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--wel) 15%, transparent)", color: "var(--wel)" }}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{r.title}</span>
                {r.description && (
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{r.description}</span>
                )}
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-slate-500 transition group-hover:text-white" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ─── Recruiting CTA ─────────────────────────────────────────────────────────

function Recruit({ cfg }) {
  const applyUrl = safeLinkUrl(cfg.recruitFormUrl);
  return (
    <section>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-[var(--color-surface-2)] p-6 sm:flex-row sm:items-center">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--wel) 15%, transparent)", color: "var(--wel)" }}
        >
          <ShieldCheck size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-white">
            Join the {cfg.shortName || cfg.fullName || "Department"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {cfg.recruitDescription || "We're recruiting — become part of the team."}
          </p>
        </div>
        {applyUrl && (
          <a
            href={applyUrl}
            target="_blank"
            rel="noreferrer"
            className="press lift-slow inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:brightness-110"
            style={{ background: "var(--wel)" }}
          >
            Apply Now
            <ArrowRight size={16} />
          </a>
        )}
      </div>
    </section>
  );
}

export default function WelcomePage({ page }) {
  const { config } = useConfig();
  const cfg = page?.config || {};
  const show = cfg.show || {};
  const on = (k) => show[k] !== false; // default visible
  const kicker = cfg.kicker || config?.branding?.name || "";
  const accent = cfg.accent || "var(--color-primary)";

  // Command staff can be a manual list, or sourced live from a Chain of Command
  // page so names aren't maintained twice.
  const chainPage =
    cfg.commandSource &&
    (config?.pages || []).find((p) => p.id === cfg.commandSource && p.type === "chain");
  const staff = chainPage
    ? commandStaffFromChain(config, chainPage, { levels: cfg.commandLevels || 4 })
    : cfg.commandStaff || [];

  return (
    <div style={{ "--wel": accent }} className="grid gap-12">
      <Hero cfg={cfg} kicker={kicker} />
      {on("ticker") && <Ticker notices={cfg.notices} />}
      <div className="mx-auto grid w-full max-w-[1200px] gap-14 px-4 pb-16 sm:px-6">
        {on("about") && <About cfg={cfg} />}
        {on("commandStaff") && <CommandStaff staff={staff} />}
        {on("media") && <Gallery cfg={cfg} />}
        {on("resources") && <Resources cfg={cfg} />}
        {on("recruiting") && <Recruit cfg={cfg} />}
      </div>
    </div>
  );
}
