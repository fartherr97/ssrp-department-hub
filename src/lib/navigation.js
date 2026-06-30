/*
 * Navigation is derived entirely from config.pages + config.navGroups, filtered
 * by what the current user may access. Returns ordered groups, each with its
 * visible pages, so the top-bar nav can render without any hard-coded routes.
 */
import { canAccessPage } from "./permissions.js";

export function buildNav(config, user) {
  const pages = config?.pages || [];
  const order = config?.navGroups || [];

  // navGroups is the source of truth for what appears in the top bar. A page
  // whose navGroup was deleted falls under the first group rather than
  // resurrecting a phantom heading, so removing a group really removes it.
  const fallback = order[0];
  const groupOf = (p) => (order.includes(p.navGroup) ? p.navGroup : fallback);

  return order
    .map((name) => ({
      name,
      pages: pages.filter((p) => groupOf(p) === name && canAccessPage(user, p, config)),
    }))
    .filter((group) => group.pages.length > 0);
}

export function getInitialPageId(config) {
  if (typeof window === "undefined") return config?.pages?.[0]?.id || "home";
  const fromPath = decodeURIComponent(
    window.location.pathname.replace(/^\/+/, "").split("/")[0] || ""
  );
  if (config?.pages?.some((p) => p.id === fromPath)) return fromPath;
  return config?.pages?.[0]?.id || "home";
}

export function getPagePath(pageId, config) {
  const first = config?.pages?.[0]?.id;
  return pageId === first ? "/" : `/${encodeURIComponent(pageId)}`;
}

/*
 * Page ids double as URL paths, so new pages get a readable slug from their
 * label ("Vehicle Roster" → "vehicle-roster") instead of a random id.
 * Conflicts get a numeric suffix (training, training-2, …).
 */
export function pageSlug(label, takenIds = []) {
  const base =
    String(label || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "page";
  let slug = base;
  let n = 2;
  while (takenIds.includes(slug)) slug = `${base}-${n++}`;
  return slug;
}

// Matches the random ids uid("page") used to generate, so older pages can be
// upgraded to a readable slug the next time they're saved.
export function isGeneratedPageId(id) {
  return /^page-(?:[0-9a-f]{8}|[0-9a-z]+-[0-9a-z]+)$/i.test(id || "");
}

// ── Sub-page routing (second URL segment) ────────────────────────────────────
// Pages with internal tabs (Builder tabs, roster subdivisions) expose them as
// /pageId/subId so every view is directly linkable.

export function getSubPagePath() {
  if (typeof window === "undefined") return "";
  return decodeURIComponent(
    window.location.pathname.replace(/^\/+/, "").split("/")[1] || ""
  );
}

export function buildSubPath(pageId, subId) {
  return `/${encodeURIComponent(pageId)}${subId ? `/${encodeURIComponent(subId)}` : ""}`;
}
