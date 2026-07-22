/*
 * Duty hours — backs src/lib/api.js getDutyHours().
 *
 *   GET  /api/hours  → { updatedAt, source, members: [{ discordId, name, weekHours, monthHours }] }
 *
 * The real numbers live in the external Duty Hub. Wire it one of two ways:
 *   1. Have a bot/cron POST the latest hours to /api/hours (cached in duty_hours).
 *   2. Or replace the body of GET with a live fetch+cache from the Duty Hub API.
 *
 * Out of the box GET returns whatever was last cached (empty until something
 * feeds it). The front-end joins these to roster members by discordId for rank,
 * callsign, and strike counts, so this endpoint only needs the raw hours.
 */
import { Router } from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../permissions.js";
import { resolveDepartmentId, validDepartmentId } from "../tenant.js";
import { safeEqual } from "../security.js";
import { botSecretFor } from "../env.js";

async function ensureTable() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS duty_hours (
      department_id VARCHAR(64) NOT NULL PRIMARY KEY,
      payload       JSON        NOT NULL,
      updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

function botAuthed(req, departmentId) {
  const expected = botSecretFor(departmentId);
  if (!expected) return false;
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return safeEqual(token, expected);
}

export function hoursRouter() {
  const router = Router();

  router.get("/hours", requireAuth, async (req, res, next) => {
    try {
      await ensureTable();
      const db = getPool();
      const departmentId = req.departmentId || resolveDepartmentId(req);
      const [rows] = await db.query(
        "SELECT payload, updated_at FROM duty_hours WHERE department_id = ? LIMIT 1",
        [departmentId]
      );
      if (!rows.length) {
        return res.json({ ok: true, data: { updatedAt: null, source: "backend", members: [] } });
      }
      const payload =
        typeof rows[0].payload === "string" ? JSON.parse(rows[0].payload) : rows[0].payload;
      res.json({
        ok: true,
        data: { updatedAt: rows[0].updated_at, source: "duty-hub", members: payload.members || [] },
      });
    } catch (err) {
      next(err);
    }
  });

  // Feed endpoint for the Duty Hub bot/cron (shared-secret auth, not a session).
  router.post("/hours", async (req, res, next) => {
    try {
      const { members, departmentId: bodyDept } = req.body || {};
      if (bodyDept != null && !validDepartmentId(bodyDept)) {
        return res.status(400).json({ ok: false, error: "Invalid departmentId" });
      }
      const departmentId = validDepartmentId(bodyDept) || resolveDepartmentId(req);
      if (!botAuthed(req, departmentId)) {
        return res.status(401).json({ ok: false, error: "Bot authentication required" });
      }
      if (!Array.isArray(members)) {
        return res.status(400).json({ ok: false, error: "Expected { members: [...] }" });
      }
      await ensureTable();
      const db = getPool();
      await db.query(
        `INSERT INTO duty_hours (department_id, payload) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
        [departmentId, JSON.stringify({ members })]
      );
      res.json({ ok: true, data: { count: members.length } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
