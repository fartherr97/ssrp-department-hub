/*
 * Discord rank sync (bot → roster). Documented in README "Discord rank sync".
 *
 *   POST /api/roster/sync  { discordId, roleIds: [] }
 *
 * Called by the Discord bot (NOT a logged-in user) on guildMemberUpdate. It is
 * authenticated with a shared secret in the Authorization header, never a
 * session. The actual rank logic lives in the pure helper the front-end uses,
 * so the rules (highest-first match, promotion-date stamping, callsign
 * assignment) stay identical everywhere.
 */
import { Router } from "express";
import { botSecretFor } from "../env.js";
import { loadConfig, saveConfig, appendAudit } from "../db.js";
import { resolveDepartmentId, validDepartmentId } from "../tenant.js";
import { safeEqual } from "../security.js";
import { syncMemberRanksFromDiscord } from "../../src/lib/roster.js";

// Authenticate the bot against the secret for the SPECIFIC department it named,
// so a leaked secret for one tenant can't be used to write another.
function botAuthed(req, departmentId) {
  const expected = botSecretFor(departmentId);
  if (!expected) return false; // not configured for this dept → refuse
  const header = req.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return safeEqual(token, expected);
}

export function rosterRouter() {
  const router = Router();

  router.post("/roster/sync", async (req, res, next) => {
    try {
      const { discordId, roleIds, departmentId: bodyDept } = req.body || {};
      // The bot isn't tied to a hostname, so it names the department explicitly
      // (falls back to the request host / default for single-tenant setups). A
      // supplied id must be a valid slug so it can't be used to poke arbitrary
      // rows or smuggle junk into the audit log. Resolve it BEFORE auth so we can
      // check the bot's token against that department's own secret.
      if (bodyDept != null && !validDepartmentId(bodyDept)) {
        return res.status(400).json({ ok: false, error: "Invalid departmentId" });
      }
      const departmentId = validDepartmentId(bodyDept) || resolveDepartmentId(req);
      if (!botAuthed(req, departmentId)) {
        return res.status(401).json({ ok: false, error: "Bot authentication required" });
      }
      if (!discordId || !Array.isArray(roleIds)) {
        return res
          .status(400)
          .json({ ok: false, error: "Expected { discordId, roleIds: [], departmentId? }" });
      }
      // discordId is a Discord snowflake — reject anything that isn't a bare
      // numeric id before it reaches config lookups / audit entries.
      if (!/^\d{1,32}$/.test(String(discordId))) {
        return res.status(400).json({ ok: false, error: "Invalid discordId" });
      }

      const config = await loadConfig(departmentId);
      if (!config) return res.status(404).json({ ok: false, error: "No config yet" });

      const next = syncMemberRanksFromDiscord(config, String(discordId), roleIds.map(String));
      if (next === config) {
        return res.json({ ok: true, data: { changed: false } });
      }

      await saveConfig(departmentId, next);
      await appendAudit(departmentId, {
        id: `sync-${discordId}`,
        category: "roster",
        action: `Discord rank sync for ${discordId}`,
        actor: { name: "Discord bot", discordId: "", group: "system" },
        at: new Date().toISOString(),
      });
      res.json({ ok: true, data: { changed: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
