/*
 * Promotion-vote Discord webhook. A single site-level webhook (config.webhooks
 * .promotion) posts to a promotion-votes channel and pings a role when a vote
 * opens. Template variables let managers word the message however they like.
 *
 *   webhook: { enabled, url, roleIds, botName, avatarUrl, color, title,
 *              description, thumbnailUrl, footerText, footerIconUrl }
 *
 * Note: like the admin-log webhook, the URL lives in the config and is redacted
 * from non-manager reads (server/configView.js). Production should ideally fire
 * this server-side, but a browser POST works for Discord webhooks today.
 */

export const PROMO_VARS = ["{members}", "{member}", "{count}", "{boardLink}", "{duration}"];

export const DEFAULT_PROMO_WEBHOOK = {
  enabled: false,
  url: "",
  roleIds: "",
  botName: "",
  avatarUrl: "",
  color: "#f0852d",
  title: "Promotion Vote",
  description:
    "Hey team, the following staff member(s) have been nominated for promotion. Please head over to our [promotion board]({boardLink}) and cast your vote(s).\n\n{members}\n\nVoting ends in **{duration}**. If a nominee is unknown to you, take some time to watch them in-game before you decide.",
  thumbnailUrl: "",
  footerText: "Promotion Board",
  footerIconUrl: "",
};

export function promoWebhook(config) {
  return { ...DEFAULT_PROMO_WEBHOOK, ...(config?.webhooks?.promotion || {}) };
}

// "• 215 | Mod | J. Miller (Moderator → Senior Mod)" per nominee.
export function membersText(members) {
  return (members || [])
    .map((m) => {
      const path = m.currentRank && m.proposedRank ? ` (${m.currentRank} → ${m.proposedRank})` : m.proposedRank ? ` (→ ${m.proposedRank})` : "";
      return `• **${m.name}**${path}`;
    })
    .join("\n");
}

export function applyVars(tpl, ctx) {
  const mt = membersText(ctx.members);
  return String(tpl || "")
    .split("{members}").join(mt)
    .split("{member}").join(ctx.members?.[0]?.name || "")
    .split("{count}").join(String((ctx.members || []).length))
    .split("{boardLink}").join(ctx.boardUrl || "")
    .split("{duration}").join(ctx.durationLabel || "72 hours");
}

const rolePings = (roleIds) =>
  String(roleIds || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{5,}$/.test(s))
    .map((id) => `<@&${id}>`)
    .join(" ");

export function buildPromotionPayload(webhook, ctx) {
  const hex = String(webhook.color || "#f0852d").replace("#", "");
  const color = parseInt(hex, 16);
  const embed = {
    title: applyVars(webhook.title || "Promotion Vote", ctx),
    description: applyVars(webhook.description || "", ctx).slice(0, 4000),
    ...(Number.isFinite(color) ? { color } : {}),
    ...(webhook.thumbnailUrl ? { thumbnail: { url: webhook.thumbnailUrl } } : {}),
    ...(webhook.footerText || webhook.footerIconUrl
      ? { footer: { text: applyVars(webhook.footerText || "", ctx), ...(webhook.footerIconUrl ? { icon_url: webhook.footerIconUrl } : {}) } }
      : {}),
    timestamp: new Date(ctx.now || Date.now()).toISOString(),
  };
  const content = rolePings(webhook.roleIds);
  return {
    ...(content ? { content } : {}),
    ...(webhook.botName ? { username: webhook.botName } : {}),
    ...(webhook.avatarUrl ? { avatar_url: webhook.avatarUrl } : {}),
    embeds: [embed],
    allowed_mentions: { parse: ["roles"] },
  };
}

// Fire-and-forget POST to Discord. Returns true on a 2xx, false otherwise.
export async function sendPromotionWebhook(webhook, ctx) {
  if (!webhook?.enabled || !webhook.url) return false;
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPromotionPayload(webhook, ctx)),
    });
    return res.ok;
  } catch {
    return false;
  }
}
