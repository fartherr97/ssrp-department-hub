/*
 * Applies a department's branding colors to the document by overwriting the
 * CSS custom properties defined in tailwind.css. Every component styles against
 * these vars, so this is the only place runtime theming needs to touch.
 */

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/*
 * Selectable UI fonts. `google` is a Google Fonts css2 family spec — loaded on
 * demand via a <link> tag; "default" uses the bundled system stack only.
 */
export const FONTS = [
  { id: "default", label: "Ubuntu (default)", family: `"Ubuntu", "Segoe UI", "Tahoma", "Arial", system-ui, sans-serif` },
  { id: "inter", label: "Inter — clean & modern", family: `"Inter", "Segoe UI", system-ui, sans-serif`, google: "Inter:wght@400;500;600;700;800" },
  { id: "roboto", label: "Roboto — neutral", family: `"Roboto", "Segoe UI", system-ui, sans-serif`, google: "Roboto:wght@400;500;700;900" },
  { id: "source-sans", label: "Source Sans — friendly", family: `"Source Sans 3", "Segoe UI", system-ui, sans-serif`, google: "Source+Sans+3:wght@400;600;700;900" },
  { id: "rajdhani", label: "Rajdhani — tactical", family: `"Rajdhani", "Segoe UI", system-ui, sans-serif`, google: "Rajdhani:wght@400;500;600;700" },
  { id: "oswald", label: "Oswald — bold display", family: `"Oswald", "Segoe UI", system-ui, sans-serif`, google: "Oswald:wght@400;500;600;700" },
];

export function applyFont(fontId) {
  if (typeof document === "undefined") return;
  const font = FONTS.find((f) => f.id === fontId) || FONTS[0];

  let link = document.getElementById("hub-font-link");
  if (font.google) {
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    if (!link) {
      link = document.createElement("link");
      link.id = "hub-font-link";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  } else if (link) {
    link.remove();
  }

  const root = document.documentElement.style;
  root.setProperty("--font-body", font.family);
  root.setProperty("--font-display", font.family);
}

export function applyTheme(colors = {}) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  const set = (name, value) => value && root.setProperty(name, value);

  set("--color-primary", colors.primary);
  set("--color-hover", colors.hover);
  set("--color-bg", colors.bg);
  set("--color-surface-1", colors.surface1);
  set("--color-surface-2", colors.surface2);
  set("--color-body-bg", colors.bodyBg);

  if (colors.primary) {
    set("--color-border", rgba(colors.primary, 0.2));
    set("--color-border-strong", rgba(colors.primary, 0.36));
  }
}
