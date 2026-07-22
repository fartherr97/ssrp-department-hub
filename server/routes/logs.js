/*
 * Admin-log ingestion → Records portal (migration prep; see
 * docs/admin-logs-migration.md).
 *
 *   POST /api/logs  { bookId, bookName, type, date, subject:{name,discordId}, values:[…] }
 *
 * The hub posts one admin-log entry here. The SERVER stamps who logged it (from
 * the session) and the department (from the host) so neither can be forged, then
 * forwards it to the Records DB via forwardLog(). There is intentionally no GET —
 * reads come from the Records portal, not this service.
 */
import { Router } from "express";
import { requireAuth } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import { forwardLog } from "../records.js";

const MAX_LOG_BYTES = 256 * 1024; // one entry is small; cap to reject junk

export function logsRouter() {
  const router = Router();

  router.post("/logs", requireAuth, async (req, res, next) => {
    try {
      const body = req.body || {};
      if (Buffer.byteLength(JSON.stringify(body)) > MAX_LOG_BYTES) {
        return res.status(413).json({ ok: false, error: "Entry too large" });
      }
      const subject = body.subject || {};
      if (!subject.discordId && !subject.name) {
        return res.status(400).json({ ok: false, error: "Entry needs a subject (name or discordId)" });
      }
      if (subject.discordId && !/^\d{1,32}$/.test(String(subject.discordId))) {
        return res.status(400).json({ ok: false, error: "Invalid subject discordId" });
      }

      const departmentId = req.departmentId || resolveDepartmentId(req);
      const entry = {
        id: typeof body.id === "string" ? body.id : "",
        department: departmentId,
        bookId: body.bookId || "",
        bookName: body.bookName || "",
        type: body.type || "",
        date: body.date || "",
        subject: { name: subject.name || "", discordId: subject.discordId || "" },
        values: Array.isArray(body.values) ? body.values : [],
        // Server-stamped, never trusted from the client:
        by: {
          name: req.user.displayName || req.user.username || "Unknown",
          discordId: req.user.id || "",
          group: req.user.group || "",
        },
        at: new Date().toISOString(),
      };

      // A records-portal outage must not break logging in the hub.
      let result = { forwarded: false };
      try {
        result = (await forwardLog(departmentId, entry)) || result;
      } catch (err) {
        console.error("[logs] forwardLog failed:", err);
      }

      res.json({ ok: true, data: { entry, ...result } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
