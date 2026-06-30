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

const SCOPES = ["identify", "guilds.members.read"];

function avatarUrl(userId, hash) {
  if (!hash) return "";
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=128`;
}

// Pull the member's nickname + role ids in our guild using the OAuth token.
async function fetchGuildMember(accessToken, guildId) {
  if (!guildId) return { nick: null, roleIds: [] };
  try {
    const res = await fetch(
      `https://discord.com/api/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return { nick: null, roleIds: [] };
    const body = await res.json();
    return { nick: body.nick || null, roleIds: body.roles || [] };
  } catch {
    return { nick: null, roleIds: [] };
  }
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
          const { nick, roleIds } = await fetchGuildMember(accessToken, env.discord.guildId);
          // Resolve the group against the department the user logged in from.
          const config = await loadConfig(resolveDepartmentId(req));
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

  // Optional: local-only dev login so you can exercise the real backend without
  // standing up Discord OAuth. Refuses to run in production.
  app.post("/auth/dev-login", (req, res) => {
    if (!env.devLoginEnabled) {
      return res.status(403).json({ ok: false, error: "Dev login disabled" });
    }
    const group = String(req.body?.group || "member");
    const user = {
      id: "dev-" + group,
      username: `Dev ${group}`,
      displayName: `Dev ${group}`,
      avatarUrl: "",
      group,
      isAdmin: group === "admin",
      isDev: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false, error: "Login failed" });
      res.json({ ok: true, data: user });
    });
  });
}
