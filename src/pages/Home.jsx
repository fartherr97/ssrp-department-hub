import { useConfig } from "../lib/configContext.jsx";
import { Panel } from "../components/common/index.jsx";
import BlockRenderer from "../components/content/BlockRenderer.jsx";
import Logo from "../components/common/Logo.jsx";

// Renders the title with the department name highlighted in the primary color
// (e.g. "Welcome to the <Florida Highway Patrol>").
function HeroTitle({ title, highlight }) {
  const idx = highlight ? title.indexOf(highlight) : -1;
  if (idx === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      <span className="text-[var(--color-primary)]">{highlight}</span>
      {title.slice(idx + highlight.length)}
    </>
  );
}

export default function Home({ page }) {
  const { config } = useConfig();
  const branding = config?.branding || {};
  const cfg = page?.config || {};
  const banner = branding.bannerUrl;
  const title = cfg.heroTitle || `Welcome to ${branding.name}`;

  return (
    <div className="grid gap-6">
      <Panel className="relative overflow-hidden p-8 sm:p-12">
        {banner && (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner})` }}
          />
        )}
        {/* Readability overlay: opaque on the left (text), fading to reveal the banner on the right. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: banner
              ? "linear-gradient(90deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 78%, transparent) 48%, color-mix(in srgb, var(--color-bg) 20%, transparent) 100%)"
              : undefined,
          }}
        />
        {!banner && <div className="hub-shell-gradient pointer-events-none absolute inset-0 opacity-60" />}

        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Logo branding={branding} size={72} />
          <div>
            {cfg.heroKicker && <div className="hub-kicker">{cfg.heroKicker}</div>}
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              <HeroTitle title={title} highlight={branding.name} />
            </h1>
            {cfg.heroSubtitle && (
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-text-muted)]">
                {cfg.heroSubtitle}
              </p>
            )}
          </div>
        </div>
      </Panel>

      <BlockRenderer blocks={cfg.blocks} />
    </div>
  );
}
