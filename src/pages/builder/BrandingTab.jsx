import { useConfig } from "../../lib/configContext.jsx";
import Logo from "../../components/common/Logo.jsx";
import {
  Panel,
  SectionHeader,
  Field,
  Input,
  Textarea,
  ColorInput,
} from "../../components/common/index.jsx";

const COLOR_FIELDS = [
  { key: "primary", label: "Primary / accent" },
  { key: "hover", label: "Primary hover" },
  { key: "bodyBg", label: "Page background" },
  { key: "bg", label: "Shell background" },
  { key: "surface1", label: "Surface 1" },
  { key: "surface2", label: "Surface 2" },
];

// One-click palettes. "SSRP CAD" is the kit's dark-navy default; the rest are
// the same surface recipe re-hued for departments that want a different accent.
const PRESETS = [
  {
    id: "ssrp-cad",
    label: "SSRP CAD",
    colors: { primary: "#3d82f0", hover: "#5a97f5", bg: "#101d31", surface1: "#13233b", surface2: "#192f4d", bodyBg: "#0b1424" },
  },
  {
    id: "emerald",
    label: "Emerald",
    colors: { primary: "#10b981", hover: "#34d399", bg: "#102420", surface1: "#13291f", surface2: "#1b3a2c", bodyBg: "#08140f" },
  },
  {
    id: "crimson",
    label: "Crimson",
    colors: { primary: "#ef4444", hover: "#f87171", bg: "#241318", surface1: "#2c151c", surface2: "#3b1c25", bodyBg: "#150a0d" },
  },
  {
    id: "violet",
    label: "Violet",
    colors: { primary: "#8b5cf6", hover: "#a78bfa", bg: "#1b1733", surface1: "#211b3c", surface2: "#2e2551", bodyBg: "#100c20" },
  },
];

export default function BrandingTab() {
  const { config, mutate } = useConfig();
  const b = config.branding;

  const setBrand = (patch) =>
    mutate((cfg) => ({ ...cfg, branding: { ...cfg.branding, ...patch } }));
  const setColor = (key, value) =>
    mutate((cfg) => ({
      ...cfg,
      branding: { ...cfg.branding, colors: { ...cfg.branding.colors, [key]: value } },
    }));
  const applyPreset = (colors) =>
    mutate((cfg) => ({
      ...cfg,
      branding: { ...cfg.branding, colors: { ...cfg.branding.colors, ...colors } },
    }));

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader title="Identity" subtitle="Names shown throughout the hub." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department name">
            <Input value={b.name} onChange={(e) => setBrand({ name: e.target.value })} />
          </Field>
          <Field label="Short name" hint="Shown in the top bar.">
            <Input value={b.shortName} onChange={(e) => setBrand({ shortName: e.target.value })} />
          </Field>
          <Field label="Organization / tagline line">
            <Input
              value={b.organization}
              onChange={(e) => setBrand({ organization: e.target.value })}
            />
          </Field>
          <Field label="Logo URL" hint="Leave blank for an auto-generated monogram.">
            <Input value={b.logoUrl} onChange={(e) => setBrand({ logoUrl: e.target.value })} />
          </Field>
          <Field
            label="Home banner image URL"
            hint="Background image for the Home page hero. Leave blank for a plain gradient."
          >
            <Input value={b.bannerUrl} onChange={(e) => setBrand({ bannerUrl: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
          <Logo branding={b} size={48} />
          <div className="text-sm text-slate-400">Logo preview</div>
        </div>
        {b.bannerUrl && (
          <div
            className="mt-3 h-24 rounded-xl border border-white/10 bg-cover bg-center"
            style={{ backgroundImage: `url(${b.bannerUrl})` }}
            title="Banner preview"
          />
        )}
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Login screen" subtitle="The signed-out landing page." />
        <div className="grid gap-4">
          <Field label="Headline">
            <Input
              value={b.loginHeadline}
              onChange={(e) => setBrand({ loginHeadline: e.target.value })}
            />
          </Field>
          <Field label="Subtext">
            <Textarea
              rows={2}
              value={b.loginSubtext}
              onChange={(e) => setBrand({ loginSubtext: e.target.value })}
            />
          </Field>
          <Field label="Footer text">
            <Input value={b.footerText} onChange={(e) => setBrand({ footerText: e.target.value })} />
          </Field>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader
          title="Theme colors"
          subtitle="Applied live across the whole hub. Hex values."
        />
        <div className="mb-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
            Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.colors)}
                className="press flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-[color:var(--color-border-strong)] hover:text-white"
              >
                <span className="flex -space-x-1">
                  <span
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ background: p.colors.primary }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ background: p.colors.bodyBg }}
                  />
                </span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {COLOR_FIELDS.map((c) => (
            <Field key={c.key} label={c.label}>
              <ColorInput value={b.colors[c.key]} onChange={(v) => setColor(c.key, v)} />
            </Field>
          ))}
        </div>
      </Panel>
    </div>
  );
}
