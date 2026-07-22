/*
 * HTTP security headers (helmet configuration), factored out so the exact policy
 * can be exercised by tests against the built front-end.
 *
 * Content-Security-Policy is the headline: it's a browser-enforced allowlist of
 * where the page may load each kind of resource from. Even though the app
 * sanitizes user-configured URLs at render (src/lib/urls.js), CSP is the
 * defense-in-depth backstop — if a single sink is ever missed, `script-src
 * 'self'` still stops injected JavaScript from executing.
 *
 * The policy is deliberately strict for SCRIPTS (self only — the Vite build emits
 * only external, hashed module scripts, no inline) and permissive for MEDIA
 * (departments legitimately embed images/video/iframes from arbitrary https
 * hosts, and the URL sanitizers already bound the allowed schemes).
 */
export function helmetOptions() {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // Scripts: same-origin only. This is the anti-XSS teeth — the build has
        // no inline scripts, so no 'unsafe-inline' is needed.
        scriptSrc: ["'self'"],
        // Styles: same-origin bundle + Google Fonts stylesheet, plus inline style
        // attributes (React style={{}} → style="…", needs 'unsafe-inline').
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // Media is department-configurable: allow any https host + our own
        // uploads (data:/blob:). Matches src/lib/urls.js safeMediaUrl.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        mediaSrc: ["'self'", "data:", "blob:", "https:"],
        // Embeds (YouTube etc.) are https-only, matching safeEmbedUrl.
        frameSrc: ["'self'", "https:"],
        // XHR/fetch: our own API (same origin) + the promotion webhook the
        // browser POSTs to Discord (https).
        connectSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"], // clickjacking: don't let other sites frame us
      },
    },
    // The app embeds cross-origin media/images, which COEP would block.
    crossOriginEmbedderPolicy: false,
    // We serve our own assets same-origin; allow the page to reference external
    // media without COEP/CORP friction.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  };
}
