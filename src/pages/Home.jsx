import { useConfig } from "../lib/configContext.jsx";
import { Panel } from "../components/common/index.jsx";
import BlockRenderer from "../components/content/BlockRenderer.jsx";
import Logo from "../components/common/Logo.jsx";

export default function Home({ page }) {
  const { config } = useConfig();
  const branding = config?.branding || {};
  const cfg = page?.config || {};

  return (
    <div className="grid gap-6">
      <Panel className="relative overflow-hidden p-8 sm:p-10">
        <div className="hub-shell-gradient pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Logo branding={branding} size={72} />
          <div>
            {cfg.heroKicker && (
              <div className="hub-kicker">{cfg.heroKicker}</div>
            )}
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
              {cfg.heroTitle || `Welcome to ${branding.name}`}
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
