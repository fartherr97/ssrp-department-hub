import { Plus, Trash2 } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import Logo from "../../components/common/Logo.jsx";
import { getIcon, ICON_NAMES } from "../../lib/icons.js";
import {
  Panel,
  SectionHeader,
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Select,
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

// One-click full palettes — each sets the accent AND the whole surface stack so
// the department reads distinctly (not just a re-accented navy).
const PRESETS = [
  {
    id: "ssrp-cad",
    label: "SSRP CAD",
    colors: { primary: "#3d82f0", hover: "#5a97f5", bg: "#101d31", surface1: "#13233b", surface2: "#192f4d", bodyBg: "#0b1424" },
  },
  {
    // Florida Highway Patrol — black & tan.
    id: "fhp",
    label: "FHP",
    colors: { primary: "#d2b48c", hover: "#e6d0a8", bg: "#15140f", surface1: "#1d1b15", surface2: "#2a261c", bodyBg: "#0a0908" },
  },
  {
    // Tampa Police — deep blue.
    id: "tpd",
    label: "TPD",
    colors: { primary: "#2e69f1", hover: "#5586f4", bg: "#0b1430", surface1: "#101c40", surface2: "#1a2c58", bodyBg: "#060a16" },
  },
  {
    // Hillsborough County Sheriff — green.
    id: "hcso",
    label: "HCSO",
    colors: { primary: "#1f8b4c", hover: "#2aa55c", bg: "#0c1d14", surface1: "#10261a", surface2: "#173827", bodyBg: "#07130c" },
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

  // Community links shown on the login screen ("Connect With Us").
  const socials = b.socials || [];
  const setSocials = (next) =>
    mutate((cfg) => ({ ...cfg, branding: { ...cfg.branding, socials: next } }));
  const addSocial = () =>
    setSocials([
      ...socials,
      { id: `social-${Date.now()}`, label: "New link", url: "", icon: "LinkIcon" },
    ]);
  const updateSocial = (id, patch) =>
    setSocials(socials.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSocial = (id) => setSocials(socials.filter((s) => s.id !== id));

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
          <Field
            label="Brand accent"
            hint='Part of the name shown in orange, e.g. "RP". Blank for none.'
          >
            <Input
              value={b.brandAccent || ""}
              onChange={(e) => setBrand({ brandAccent: e.target.value })}
            />
          </Field>
          <Field label="Organization / tagline line">
            <Input
              value={b.organization}
              onChange={(e) => setBrand({ organization: e.target.value })}
            />
          </Field>
          <Field
            label="Logo URL"
            hint="Square image, ~256×256px (PNG or SVG). Blank for an auto-generated monogram."
          >
            <Input value={b.logoUrl} onChange={(e) => setBrand({ logoUrl: e.target.value })} />
          </Field>
          <Field
            label="Home banner image URL"
            hint="Wide background for the Home hero, ~1600×400px. Blank for a plain gradient."
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
        <SectionHeader
          title="Login screen"
          subtitle="The signed-out landing page — header, headline, footer, and community links."
        />
        <div className="grid gap-4">
          <Field label="Headline" hint="The large title under the logo.">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Footer text" hint="Copyright line on the left of the footer bar.">
              <Input
                value={b.footerText}
                onChange={(e) => setBrand({ footerText: e.target.value })}
              />
            </Field>
            <Field label="Footer note" hint="Small text on the right (e.g. a version).">
              <Input
                value={b.footerNote || ""}
                onChange={(e) => setBrand({ footerNote: e.target.value })}
              />
            </Field>
          </div>

          {/* Community links ("Connect With Us") */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">
                Community links
              </span>
              <Button variant="secondary" icon={Plus} onClick={addSocial}>
                Add link
              </Button>
            </div>
            <div className="grid gap-2">
              {socials.length === 0 && (
                <p className="text-sm text-slate-500">
                  No links yet. Add Discord, TikTok, or other community links.
                </p>
              )}
              {socials.map((s) => {
                const Icon = getIcon(s.icon);
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-2"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[var(--color-primary)]">
                      <Icon size={16} />
                    </div>
                    <Input
                      value={s.label || ""}
                      placeholder="Label"
                      onChange={(e) => updateSocial(s.id, { label: e.target.value })}
                    />
                    <Input
                      value={s.url || ""}
                      placeholder="https://…"
                      onChange={(e) => updateSocial(s.id, { url: e.target.value })}
                    />
                    <Select
                      value={s.icon || "LinkIcon"}
                      onChange={(e) => updateSocial(s.id, { icon: e.target.value })}
                      className="w-32"
                    >
                      {ICON_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                    <IconButton
                      icon={Trash2}
                      label="Remove link"
                      onClick={() => removeSocial(s.id)}
                      className="hover:border-red-500/40 hover:text-red-300"
                    />
                  </div>
                );
              })}
            </div>
          </div>
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
