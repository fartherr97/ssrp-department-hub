/*
 * Discord OAuth2 via passport-discord.
 *
 * Flow: GET /auth/discord → Discord consent → GET /auth/discord/callback. In the
 * verify step we fetch the member's nickname + roles in THIS department's guild
 * (so role-based group mapping and `displayName` work), resolve their group from
 * the saved config, and store a compact user in the session.
 *
 * Scopes:
 *   identify              — basic profile
 *   guilds.members.read   — read the member's nick + roles in our guild
 */
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { env, assertDiscordConfigured } from "./env.js";
import { buildSessionUser } from "./permissions.js";
import { loadConfig } from "./db.js";
import { resolveDepartmentId } from "./tenant.js";
import { isSameOrigin } from "./security.js";

const SCOPES = ["identify", "guilds.members.read"];

function avatarUrl(userId, hash) {
  if (!hash) return "";
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=128`;
}

// Pull the member's nickname + role ids in ONE guild using the OAuth token.
// Returns null if the user isn't in that guild (or the call fails).
async function fetchOneGuildMember(accessToken, guildId) {
  if (!guildId) return null;
  try {
    const res = await fetch(
      `https://discord.com/api/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const body = await res.json();
    return { nick: body.nick || null, roleIds: (body.roles || []).map(String) };
  } catch {
    return null;
  }
}

// Parse a guild-id field that may hold several ids (comma / space / newline
// separated) into a clean list of snowflakes.
function parseGuildIds(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{5,25}$/.test(s));
}

// A member can carry relevant roles in the MAIN SSRP guild and in their own
// department's guild(s). Scan all of them and UNION the role ids (Discord
// snowflakes are globally unique, so there's no collision), preferring the
// department nickname for the display name, then the main-guild nickname.
async function fetchMemberRoles(accessToken, deptGuildIds, mainGuildId) {
  // Department guilds first so their nickname wins for displayName.
  const ordered = [...new Set([...deptGuildIds, mainGuildId].filter(Boolean))];
  const results = await Promise.all(ordered.map((g) => fetchOneGuildMember(accessToken, g)));
  const roleIds = new Set();
  let nick = null;
  for (const r of results) {
    if (!r) continue;
    r.roleIds.forEach((id) => roleIds.add(id));
    if (!nick && r.nick) nick = r.nick;
  }
  return { nick, roleIds: [...roleIds] };
}

export function configurePassport() {
  // Register serialize/deserialize unconditionally — req.login() needs them for
  // ANY login (including dev login), regardless of whether Discord is set up.
  // The whole user object is small, so store it directly in the session.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  const missing = assertDiscordConfigured();
  if (missing.length) {
    console.warn(
      `[auth] Discord OAuth not fully configured (missing ${missing.join(", ")}). ` +
        `/auth/discord will 503 until these env vars are set.`
    );
    return false;
  }

  passport.use(
    new DiscordStrategy(
      {
        clientID: env.discord.clientId,
        clientSecret: env.discord.clientSecret,
        callbackURL: env.discord.callbackUrl,
        scope: SCOPES,
        passReqToCallback: true,
      },
      async (req, accessToken, _refreshToken, profile, done) => {
        try {
          // Resolve the department the user logged in from first, so we can also
          // scan that department's own Discord guild(s) for roles — not just the
          // main SSRP guild.
          const config = await loadConfig(resolveDepartmentId(req));
          const deptGuildIds = parseGuildIds(config?.auth?.discordGuildId);
          const { nick, roleIds } = await fetchMemberRoles(accessToken, deptGuildIds, env.discord.guildId);
          const user = buildSessionUser(config || { groups: [] }, {
            discordId: profile.id,
            username: profile.global_name || profile.username,
            displayName: nick || profile.global_name || profile.username,
            avatarUrl: avatarUrl(profile.id, profile.avatar),
            roleIds,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );

  return true;
}

// ─── Routes (mounted at /auth) ───────────────────────────────────────────────

export function mountAuthRoutes(app) {
  const ready = configurePassport();

  app.get("/auth/discord", (req, res, next) => {
    if (!ready) return res.status(503).json({ ok: false, error: "Discord OAuth not configured" });
    passport.authenticate("discord")(req, res, next);
  });

  app.get(
    "/auth/discord/callback",
    (req, res, next) => {
      if (!ready) return res.redirect("/?auth=unconfigured");
      passport.authenticate("discord", { failureRedirect: "/?auth=failed" })(req, res, next);
    },
    (_req, res) => res.redirect("/")
  );

  app.get("/auth/me", (req, res) => {
    res.json({ ok: true, data: req.user || null });
  });

  app.post("/auth/logout", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => res.json({ ok: true, data: null }));
    });
  });

  // Optional: dev login so you can exercise the real backend without standing up
  // Discord OAuth. Gated behind DEV_LOGIN_ENABLED (fail-closed, see env.js) so a
  // production deploy that forgets to set it can't be used to mint sessions.
  app.post("/auth/dev-login", async (req, res) => {
    if (!env.devLoginEnabled) {
      return res.status(403).json({ ok: false, error: "Dev login disabled" });
    }
    // This route is mounted at /auth (outside the /api same-origin guard), yet it
    // creates a session — so it needs its own CSRF defense. Require the request to
    // come from our own origin, exactly like sameOriginGuard does for /api.
    if (!isSameOrigin(req)) {
      return res.status(403).json({ ok: false, error: "Cross-origin request blocked" });
    }
    const group = String(req.body?.group || "member");
    // Resolve privileges from the ACTUAL group in the department config rather
    // than trusting a magic "admin" string from the client. isAdmin now means
    // exactly "this group has manageSite" — the same rule real Discord logins use
    // (see buildSessionUser) — so dev login can never grant more than a real
    // member of that group would have.
    let isAdmin = false;
    try {
      const config = await loadConfig(resolveDepartmentId(req));
      const g = (config?.groups || []).find((x) => x.id === group);
      isAdmin = !!g?.manageSite;
    } catch {
      /* no config / unknown group → isAdmin stays false */
    }
    const user = {
      id: "dev-" + group,
      username: `Dev ${group}`,
      displayName: `Dev ${group}`,
      avatarUrl: "",
      group,
      isAdmin,
      isDev: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false, error: "Login failed" });
      res.json({ ok: true, data: user });
    });
  });
}
