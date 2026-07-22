/*
 * Discord OAuth2 via passport-oauth2 (Discord's authorize/token endpoints + a
 * /users/@me profile fetch).
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
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import { env, assertDiscordConfigured } from "./env.js";
import { buildSessionUser, reconcileUserWithConfig } from "./permissions.js";
import { loadConfig, saveConfig } from "./db.js";
import { resolveDepartmentId } from "./tenant.js";
import { applyDiscordAvatar } from "../src/lib/roster.js";
import { isSameOrigin } from "./security.js";

const SCOPES = ["identify", "guilds.members.read"];

// Discord's OAuth2 endpoints (previously supplied by the now-unmaintained
// passport-discord wrapper; we drive the maintained passport-oauth2 base
// strategy directly instead).
const DISCORD_AUTHORIZATION_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";

// Fetch the signed-in user's own Discord profile (id, username, global_name,
// avatar) with the OAuth access token — the "identify" scope. Replaces the
// profile parsing passport-discord used to do.
async function fetchDiscordProfile(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord profile fetch failed (${res.status})`);
  return res.json();
}

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

  const strategy = new OAuth2Strategy(
    {
      authorizationURL: DISCORD_AUTHORIZATION_URL,
      tokenURL: DISCORD_TOKEN_URL,
      clientID: env.discord.clientId,
      clientSecret: env.discord.clientSecret,
      callbackURL: env.discord.callbackUrl,
      scope: SCOPES,
      // CSRF protection for the OAuth round trip: passport stores a random
      // `state` in the session on the redirect out and verifies it on the way
      // back, so an attacker can't feed a victim a callback with their own
      // authorization code (login CSRF / forced sign-in).
      state: true,
      passReqToCallback: true,
    },
    // 5-arg verify (req first): passport-oauth2 inspects arity and omits the raw
    // token params, matching the previous passport-discord signature.
    async (req, accessToken, _refreshToken, profile, done) => {
      try {
        // Resolve the department the user logged in from first, so we can also
        // scan that department's own Discord guild(s) for roles — not just the
        // main SSRP guild.
        const departmentId = resolveDepartmentId(req);
        const config = await loadConfig(departmentId);
        const deptGuildIds = parseGuildIds(config?.auth?.discordGuildId);
        const { nick, roleIds } = await fetchMemberRoles(accessToken, deptGuildIds, env.discord.guildId);
        const avatar = avatarUrl(profile.id, profile.avatar);
        const user = buildSessionUser(
          config || { groups: [] },
          {
            discordId: profile.id,
            username: profile.global_name || profile.username,
            displayName: nick || profile.global_name || profile.username,
            avatarUrl: avatar,
            roleIds,
          },
          departmentId
        );
        // Keep the signed-in member's roster avatar current with their Discord
        // profile picture (only writes when it actually changed).
        if (config && avatar) {
          const next = applyDiscordAvatar(config, profile.id, avatar);
          if (next !== config) {
            try {
              await saveConfig(departmentId, next);
            } catch (e) {
              console.warn("[auth] could not update roster avatar:", e?.message || e);
            }
          }
        }
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  );

  // passport-oauth2's default userProfile returns nothing; fetch the Discord
  // identity ourselves so `profile` in the verify callback carries id / username
  // / global_name / avatar (what passport-discord used to provide).
  strategy.userProfile = (accessToken, done) => {
    fetchDiscordProfile(accessToken).then(
      (p) => done(null, p),
      (err) => done(err)
    );
  };

  passport.use("discord", strategy);

  return true;
}

// ─── Routes (mounted at /auth) ───────────────────────────────────────────────

export function mountAuthRoutes(app) {
  const ready = configurePassport();

  app.get("/auth/discord", (req, res, next) => {
    if (!ready) return res.status(503).json({ ok: false, error: "Discord OAuth not configured" });
    passport.authenticate("discord")(req, res, next);
  });

  app.get("/auth/discord/callback", (req, res, next) => {
    if (!ready) return res.redirect("/?auth=unconfigured");
    // Custom callback so we can regenerate the session id BEFORE establishing the
    // login — passport/express-session don't do this for us, and reusing a
    // pre-auth session id is a session-fixation hole. `state` is already verified
    // by the strategy before this callback runs.
    passport.authenticate("discord", (err, user) => {
      if (err || !user) return res.redirect("/?auth=failed");
      req.session.regenerate((regenErr) => {
        if (regenErr) return next(regenErr);
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          res.redirect("/");
        });
      });
    })(req, res, next);
  });

  app.get("/auth/me", async (req, res) => {
    if (!req.user) return res.json({ ok: true, data: null });
    // Reflect the caller's CURRENT standing (group/isAdmin) from the live config,
    // not the login-time snapshot, so a demotion updates the client UI on its next
    // fetch — matching the server-side enforcement, which already re-checks every
    // request. Best-effort: if the config can't be loaded, fall back to the
    // session copy rather than failing the profile call.
    try {
      const config = await loadConfig(resolveDepartmentId(req));
      if (config) return res.json({ ok: true, data: reconcileUserWithConfig(req.user, config) });
    } catch {
      /* fall through to the session snapshot */
    }
    res.json({ ok: true, data: req.user });
  });

  app.post("/auth/logout", (req, res) => {
    // Logout mints a state change (destroys the session), so — like dev-login —
    // it needs its own CSRF defense: it sits outside the /api same-origin guard.
    // Without this, a cross-site page could force-log-out a signed-in user.
    if (!isSameOrigin(req)) {
      return res.status(403).json({ ok: false, error: "Cross-origin request blocked" });
    }
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
    const departmentId = resolveDepartmentId(req);
    // Resolve privileges from the ACTUAL group in the department config rather
    // than trusting a magic "admin" string from the client. isAdmin now means
    // exactly "this group has manageSite" — the same rule real Discord logins use
    // (see buildSessionUser) — so dev login can never grant more than a real
    // member of that group would have.
    let isAdmin = false;
    try {
      const config = await loadConfig(departmentId);
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
      // Bind this dev session to the department it was minted for (see
      // hydrateSessionUser) so it can't be replayed against another tenant.
      loginDepartmentId: departmentId,
    };
    // Regenerate the session id before login (fixation defense), same as the
    // Discord callback.
    req.session.regenerate((regenErr) => {
      if (regenErr) return res.status(500).json({ ok: false, error: "Login failed" });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ ok: false, error: "Login failed" });
        res.json({ ok: true, data: user });
      });
    });
  });
}
