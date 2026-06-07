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

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader title="Identity" subtitle="Names shown throughout the hub." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department name">
            <Input value={b.name} onChange={(e) => setBrand({ name: e.target.value })} />
          </Field>
          <Field label="Short name" hint="Shown in the sidebar.">
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
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3">
          <Logo branding={b} size={48} />
          <div className="text-sm text-slate-400">Logo preview</div>
        </div>
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
