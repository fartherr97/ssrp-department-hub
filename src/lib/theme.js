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
