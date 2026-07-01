/*
 * Server-side config views. The stored config is one document that mixes public
 * presentation (branding, theme) with sensitive data (member Discord ids, Discord
 * role→group mappings, and admin-log Discord webhook URLs — a webhook URL is a
 * write credential for a Discord channel). GET /api/config must never hand the
 * whole thing to just anyone, so we shape it to the caller:
 *
 *   - unauthenticated  → publicConfig(): only what the login screen needs.
 *   - signed-in, non-manager → redactSensitive(): full config minus webhook URLs.
 *   - manageSite       → the full document, untouched.
 *
 * PUT is the inverse problem: a non-manager who legitimately edits (say) roster
 * data still PUTs the whole config, and their copy has the webhook URLs redacted.
 * mergeRedactedBack() restores the real secrets from the stored config before we
 * save, so an in-scope edit can never blank them out. (authorizeConfigChange in
 * routes/config.js separately blocks changes to sections they may not touch.)
 */

// A sentinel that survives a JSON round-trip and is easy to detect on write-back.
export const REDACTED = "__redacted__";

// The minimal, safe-for-anyone view used before a user signs in. Deliberately an
// allowlist: add fields here only after confirming they carry nothing sensitive.
export function publicConfig(config) {
  if (!config || typeof config !== "object") return config;
  return {
    version: config.version,
    branding: config.branding || {},
    // The login screen's dev-login picker needs id/label/level to render the
    // group options and default to the top group — nothing more. No members, no
    // capability flags, no role mappings.
    groups: (config.groups || []).map((g) => ({
      id: g.id,
      label: g.label,
      level: g.level ?? 0,
    })),
    // The single flag the login screen reads to decide whether to show dev login.
    auth: { devLoginEnabled: !!config.auth?.devLoginEnabled },
    // Nav shape is harmless and lets the shell paint immediately after login.
    navGroups: config.navGroups || [],
    dropdownGroups: config.dropdownGroups || [],
  };
}

// Walk pages and blank any Discord webhook URL. Returns a deep-ish copy so we
// never mutate the cached/stored object. Only page.config.webhook.url is a
// secret; everything else about the webhook (styling, role pings) is fine.
export function redactSensitive(config) {
  if (!config || typeof config !== "object") return config;
  const pages = (config.pages || []).map((page) => {
    const url = page?.config?.webhook?.url;
    if (!url) return page;
    return {
      ...page,
      config: {
        ...page.config,
        webhook: { ...page.config.webhook, url: REDACTED },
      },
    };
  });
  return { ...config, pages };
}

// Before persisting an incoming config from a non-manager, restore any webhook
// URL they received redacted (so a routine save can't wipe the real secret). We
// match pages by id and only touch the redaction sentinel.
export function mergeRedactedBack(incoming, stored) {
  if (!incoming || typeof incoming !== "object") return incoming;
  const storedById = new Map((stored?.pages || []).map((p) => [p.id, p]));
  const pages = (incoming.pages || []).map((page) => {
    if (page?.config?.webhook?.url !== REDACTED) return page;
    const realUrl = storedById.get(page.id)?.config?.webhook?.url || "";
    return {
      ...page,
      config: { ...page.config, webhook: { ...page.config.webhook, url: realUrl } },
    };
  });
  return { ...incoming, pages };
}
