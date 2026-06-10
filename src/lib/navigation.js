/*
 * Navigation is derived entirely from config.pages + config.navGroups, filtered
 * by what the current user may access. Returns ordered groups, each with its
 * visible pages, so the top-bar nav can render without any hard-coded routes.
 */
import { canAccessPage } from "./permissions.js";

export function buildNav(config, user) {
  const pages = config?.pages || [];
  const order = config?.navGroups || [];

  // Preserve navGroups order, then append any groups referenced by pages but
  // missing from navGroups (so a page is never silently hidden).
  const groupNames = [...order];
  for (const page of pages) {
    if (page.navGroup && !groupNames.includes(page.navGroup)) {
      groupNames.push(page.navGroup);
    }
  }

  return groupNames
    .map((name) => ({
      name,
      pages: pages.filter(
        (p) => p.navGroup === name && canAccessPage(user, p, config)
      ),
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
