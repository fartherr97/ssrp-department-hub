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

/*
 * Rewrite common "share page" links into the direct image URL an <img> can load.
 * People paste the link that opens the image in their browser, but for Drive,
 * Dropbox, Imgur and GitHub that's an HTML page, not the image file, so it shows
 * as a broken image. Recognized links are converted; anything else is returned
 * unchanged. (Discord CDN links can't be fixed here — they now carry an expiring
 * signature and simply stop working after a while; upload those instead.)
 */
export function normalizeMediaUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw; // not an absolute URL (relative path, data:, etc.) — leave it
  }
  const host = u.hostname.toLowerCase();

  // Google Drive: /file/d/<id>/view or ?id=<id> → the image CDN that embeds.
  if (host === "drive.google.com") {
    const id = (u.pathname.match(/\/file\/d\/([^/]+)/) || [])[1] || u.searchParams.get("id");
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  // Dropbox: any share link renders directly with ?raw=1 (dl=0 shows the page).
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return u.toString();
  }
  // Imgur: a single-image page (imgur.com/<id>) → the direct file. Albums and
  // galleries (/a/, /gallery/) have no single image, so leave those alone.
  if (host === "imgur.com" || host === "www.imgur.com") {
    const m = u.pathname.match(/^\/([a-z0-9]+)$/i);
    if (m && !["a", "gallery", "t"].includes(m[1].toLowerCase())) {
      return `https://i.imgur.com/${m[1]}.png`;
    }
  }
  // GitHub: /user/repo/blob/<path> is the HTML view → raw.githubusercontent.com.
  if (host === "github.com") {
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  return raw;
}
