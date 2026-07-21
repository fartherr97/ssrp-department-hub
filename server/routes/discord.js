/*
 * Discord member lookup — backs src/lib/api.js lookupDiscordMember().
 *
 *   GET /api/discord/member/:id → { discordId, displayName, username, source }
 *
 * Resolves a member's *guild* display name (server nickname, else global name,
 * else username) from a Discord ID. Used to auto-fill the subject of an Admin
 * Log entry when a staff member pastes an ID.
 *
 * This needs a bot in the guild with the Server Members privileged intent and a
 * DISCORD_BOT_TOKEN set. OAuth alone can only read the *signed-in* user's own
 * member, never an arbitrary one, so a bot token is the only way to look up
 * someone else. When no token is configured this returns data:null and the
 * front-end falls back to matching the ID against the roster it already has.
 */
import { Router } from "express";
import { requireAuth } from "../permissions.js";
import { env } from "../env.js";

// Small in-memory cache so repeated lookups (and retyping) don't hammer the
// Discord API or trip its rate limits. Keyed by "guildId:userId".
const cache = new Map(); // key → { at, value }
const TTL_MS = 5 * 60 * 1000;

function cached(key) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > TTL_MS) return undefined;
  return hit.value;
}

export function discordRouter() {
  const router = Router();

  router.get("/discord/member/:id", requireAuth, async (req, res, next) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!/^\d{17,20}$/.test(id)) {
        return res.status(400).json({ ok: false, error: "Invalid Discord ID" });
      }
      const { botToken, guildId } = env.discord;
      // Not configured for guild lookups — let the client fall back locally.
      if (!botToken || !guildId) {
        return res.json({ ok: true, data: null });
      }

      const key = `${guildId}:${id}`;
      const hit = cached(key);
      if (hit !== undefined) return res.json({ ok: true, data: hit });

      const resp = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${id}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (resp.status === 404) {
        cache.set(key, { at: Date.now(), value: null });
        return res.json({ ok: true, data: null });
      }
      if (!resp.ok) {
        // Rate limited or misconfigured token — don't cache, let the client
        // fall back to its local directory.
        return res.json({ ok: true, data: null });
      }

      const m = await resp.json().catch(() => ({}));
      const u = m.user || {};
      const displayName = m.nick || u.global_name || u.username || "";
      const value = displayName
        ? { discordId: id, displayName, username: u.username || "", source: "guild" }
        : null;
      cache.set(key, { at: Date.now(), value });
      res.json({ ok: true, data: value });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
