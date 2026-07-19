/*
 * Pure Chain-of-Command helpers, shared by the Chain page and anything that
 * wants to mirror its data live (e.g. the Welcome page's Command Staff). Kept
 * dependency-free (config in, plain data out) so importers don't pull the whole
 * Chain page bundle.
 */

// "Rank - Assignment" → { rank, sub } so a card/box can stack the two lines.
export function splitTitle(title = "") {
  const m = title.match(/^(.*?)\s[-–—]\s(.+)$/);
  if (m) return { rank: m[1].trim(), sub: m[2].trim() };
  return { rank: title.trim(), sub: "" };
}

// Resolve a box's live roster link to the current holder name(s). Never throws;
// a link whose target was renamed/deleted reports ok:false so callers can fall
// back to the box's cached snapshot.
export function resolveNodeLink(config, link) {
  const subs = config?.roster?.subdivisions || [];
  const sub = subs.find((s) => s.id === link?.subId) || subs.find((s) => s.main) || subs[0];
  if (!sub || !link) return { ok: false, names: [] };
  const all = [];
  for (const cat of sub.categories || [])
    for (const m of cat.members || []) all.push({ name: m.name, rank: m.rank, fields: m.fields, _cat: cat.id });

  let ok = true;
  let matched = [];
  if (link.kind === "rank") {
    ok = (sub.ranks || []).some((r) => r.id === link.rankId);
    matched = all.filter((m) => m.rank === link.rankId);
  } else if (link.kind === "field") {
    ok = (config?.roster?.memberFields || []).some((f) => f.id === link.fieldId);
    matched = all.filter((m) => String(m.fields?.[link.fieldId] ?? "") === String(link.value));
  } else if (link.kind === "category") {
    ok = (sub.categories || []).some((c) => c.id === link.categoryId);
    matched = all.filter((m) => m._cat === link.categoryId);
  } else {
    return { ok: false, names: [] };
  }
  return { ok, names: matched.map((m) => m.name).filter(Boolean) };
}

// What a box should actually display: live names when linked (falling back to the
// cached snapshot if the link is broken), or the hand-typed values otherwise.
export function resolveNodeDisplay(config, node) {
  if (!node?.link) {
    return { name: node?.name || "", members: node?.members || [], linked: false, broken: false, vacant: false };
  }
  const r = resolveNodeLink(config, node.link);
  if (!r.ok) {
    return { name: node.name || "", members: node.members || [], linked: true, broken: true, vacant: false };
  }
  if (r.names.length === 0) return { name: "", members: [], linked: true, broken: false, vacant: true };
  if (r.names.length === 1) return { name: r.names[0], members: [], linked: true, broken: false, vacant: false };
  return { name: "", members: r.names, linked: true, broken: false, vacant: false };
}

// Card tier (color) by how deep a box sits under the root, so a sourced staff
// list fades gold → silver → blue down the hierarchy.
function tierForDepth(depth) {
  if (depth <= 2) return "command";
  if (depth === 3) return "supervisor";
  return "officer";
}

/*
 * Flatten a Chain-of-Command tree into Welcome-page command-staff cards. Walks
 * top-down, skips the root org box, and includes named boxes down to `levels`
 * deep. Names resolve live from the roster when a box is linked.
 *   → [{ id, name, rank, avatarUrl, tier }]
 */
export function commandStaffFromChain(config, chainPage, { levels = 4 } = {}) {
  const root = chainPage?.config?.root;
  if (!root) return [];
  const out = [];
  const walk = (node, depth) => {
    if (!node || depth > levels) return;
    if (depth >= 1) {
      const disp = resolveNodeDisplay(config, node);
      const name = disp.name || disp.members?.[0] || node.name || "";
      if (name) {
        out.push({
          id: node.id,
          name,
          rank: node.title || "",
          avatarUrl: node.imageUrl || "",
          tier: tierForDepth(depth),
        });
      }
    }
    (node.children || []).forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return out;
}
