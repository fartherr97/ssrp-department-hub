/*
 * URL sanitizers for user-configurable content. Anything a Department Head
 * types into the Builder (links, embeds, media) ends up in href / src
 * attributes, so dangerous schemes (javascript:, data:text/html, …) must
 * never reach the DOM. Editors are trusted-ish, but a department admin must
 * not be able to plant script that runs in their members' sessions.
 */

// Clickable links: web URLs, mail, in-page anchors, and relative paths.
const SAFE_LINK = /^(https?:|mailto:|#|\/)/i;

// Media (img/video src): web URLs, our own uploads (data:image|video, blob).
const SAFE_MEDIA = /^(https?:|data:image\/|data:video\/|blob:|\/)/i;

// Embedded iframes are the most sensitive sink: https only.
const SAFE_EMBED = /^https:\/\//i;

export function safeLinkUrl(url) {
  const u = String(url || "").trim();
  return SAFE_LINK.test(u) ? u : "#";
}

export function safeMediaUrl(url) {
  const u = String(url || "").trim();
  return SAFE_MEDIA.test(u) ? u : "";
}

export function safeEmbedUrl(url) {
  const u = String(url || "").trim();
  return SAFE_EMBED.test(u) ? u : "";
}
