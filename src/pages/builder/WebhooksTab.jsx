import { useState } from "react";
import { Webhook, Send, Save, Check } from "lucide-react";
import { useConfig } from "../../lib/configContext.jsx";
import useToast from "../../hooks/useToast.js";
import { Panel, Button, Field, Input, Textarea, Toast, ColorInput } from "../../components/common/index.jsx";
import {
  promoWebhook, PROMO_VARS, applyVars, membersText, sendPromotionWebhook, buildPromotionPayload,
} from "../../lib/webhooks.js";

const SAMPLE = {
  members: [
    { name: "215 | Mod | J. Miller", currentRank: "Moderator", proposedRank: "Senior Mod" },
    { name: "103 | Trial Mod | K. Vale", currentRank: "Trial Mod", proposedRank: "Moderator" },
  ],
  boardUrl: "https://your-hub.example/promotion-board",
  durationLabel: "72 hours",
};

// A Discord-embed-like preview of the outgoing message.
function EmbedPreview({ wh }) {
  const desc = applyVars(wh.description, SAMPLE);
  const title = applyVars(wh.title, SAMPLE);
  const roles = String(wh.roleIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="rounded-xl border border-white/10 bg-[#313338] p-3 text-sm">
      {roles.length > 0 && <div className="mb-1.5 rounded bg-[#5865f2]/25 px-1.5 py-0.5 text-xs font-semibold text-[#c9cdfb] w-fit">@role</div>}
      <div className="flex items-start gap-2">
        {wh.avatarUrl ? <img src={wh.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <div className="h-9 w-9 rounded-full bg-white/10" />}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">{wh.botName || "Webhook"}</span>
            <span className="rounded bg-[#5865f2] px-1 text-[9px] font-bold text-white">APP</span>
          </div>
          <div className="rounded border-l-4 bg-[#2b2d31] p-3" style={{ borderColor: wh.color || "#f0852d" }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-[#dbdee1]">{desc}</div>
                {(wh.footerText || wh.footerIconUrl) && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#949ba4]">
                    {wh.footerIconUrl && <img src={wh.footerIconUrl} alt="" className="h-4 w-4 rounded-full" onError={(e) => (e.currentTarget.style.display = "none")} />}
                    {applyVars(wh.footerText, SAMPLE)}
                  </div>
                )}
              </div>
              {wh.thumbnailUrl && <img src={wh.thumbnailUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksTab() {
  const { config, mutate } = useConfig();
  const { toast, show } = useToast();
  const [draft, setDraft] = useState(() => promoWebhook(config));
  const [testing, setTesting] = useState(false);
  const set = (p) => setDraft((d) => ({ ...d, ...p }));

  function save() {
    mutate((c) => ({ ...c, webhooks: { ...(c.webhooks || {}), promotion: { ...draft } } }));
    show("Webhook configuration saved");
  }
  async function sendTest() {
    if (!draft.url) return show("Add a webhook URL first");
    setTesting(true);
    const ok = await sendPromotionWebhook({ ...draft, enabled: true }, { ...SAMPLE, now: Date.now() });
    setTesting(false);
    show(ok ? "Test message sent" : "Couldn't reach the webhook (check the URL)");
  }

  const saved = promoWebhook(config);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/12 text-[var(--color-primary)]"><Webhook size={20} /></span>
          <div>
            <div className="font-semibold text-white">Promotion-vote webhook</div>
            <div className="text-xs text-slate-500">{saved.url ? "Webhook configured" : "Not configured"} · fires when a promotion vote opens</div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={!!draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
          Enabled
        </label>
      </Panel>

      <Panel className="p-3">
        <div className="text-xs text-slate-400">Variables: {PROMO_VARS.map((v) => <code key={v} className="mx-0.5 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-primary)]">{v}</code>)}</div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Config */}
        <div className="grid grid-cols-1 gap-4">
          <Field label="Webhook URL" hint="Discord → Channel → Integrations → Webhooks → Copy URL.">
            <Input value={draft.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://discord.com/api/webhooks/…" className="font-mono" />
          </Field>
          <Field label="Ping role IDs" hint="Role(s) @mentioned above the embed. Comma-separated Discord role IDs (right-click a role → Copy Role ID). Blank = no ping.">
            <Input value={draft.roleIds} onChange={(e) => set({ roleIds: e.target.value })} placeholder="1099647719326351380" className="font-mono" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bot name"><Input value={draft.botName} onChange={(e) => set({ botName: e.target.value })} placeholder="Sunshine State RP" /></Field>
            <Field label="Avatar URL"><Input value={draft.avatarUrl} onChange={(e) => set({ avatarUrl: e.target.value })} placeholder="https://…/logo.png" className="font-mono" /></Field>
          </div>
          <Field label="Embed color"><ColorInput value={draft.color} onChange={(color) => set({ color })} /></Field>
          <Field label="Embed title"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Embed description" hint="Supports Discord markdown and the variables above.">
            <Textarea rows={6} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Thumbnail URL"><Input value={draft.thumbnailUrl} onChange={(e) => set({ thumbnailUrl: e.target.value })} placeholder="https://…/logo.png" className="font-mono" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Footer text"><Input value={draft.footerText} onChange={(e) => set({ footerText: e.target.value })} /></Field>
            <Field label="Footer icon URL"><Input value={draft.footerIconUrl} onChange={(e) => set({ footerIconUrl: e.target.value })} className="font-mono" /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={dirty ? Save : Check} onClick={save} disabled={!dirty}>{dirty ? "Save webhook" : "Saved"}</Button>
            <Button variant="secondary" icon={Send} onClick={sendTest} disabled={testing || !draft.url}>{testing ? "Sending…" : "Send test"}</Button>
            {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
          </div>
        </div>

        {/* Preview */}
        <div className="grid grid-cols-1 gap-2 lg:sticky lg:top-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-cad-muted">Live preview <span className="font-normal normal-case text-slate-500">(sample values)</span></div>
          <EmbedPreview wh={draft} />
          <p className="text-xs text-slate-500">One message is sent when a vote opens, listing every nominee in that batch. The webhook URL is stored redacted for non-managers and restored on save, so it won't clear out.</p>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
