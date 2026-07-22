/*
 * Audit log endpoints (src/lib/api.js getAuditLog/appendAuditLog).
 *
 *   GET  /api/audit  → newest-first history
 *   POST /api/audit  → append one entry
 *
 * Append-only by design: there is deliberately NO update or delete route. The
 * log is kept forever. Any signed-in member may append (the client records who
 * acted); reads are open to signed-in members too.
 */
import { Router } from "express";
import { loadAudit, appendAudit } from "../db.js";
import { requireAuth, requireCapability } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import { currentConfig } from "./config.js";

const getConfig = (req) => currentConfig(req.departmentId || resolveDepartmentId(req));

// One audit entry (with its before/after diff) is small; cap it so a client
// can't stuff the append-only table with oversized rows.
const MAX_AUDIT_BYTES = 128 * 1024;

export function auditRouter() {
  const router = Router();

  // Reads require the "View audit log" capability (Manage site implies it): the
  // activity history is an oversight tool, not member-facing. Appends stay open
  // to any signed-in member because the client records routine actions
  // (attendance, log writes) as they happen — the server stamps the real actor.
  router.get("/audit", requireCapability("viewAuditLog", getConfig), async (req, res, next) => {
    try {
      const departmentId = req.departmentId || resolveDepartmentId(req);
      res.json({ ok: true, data: await loadAudit(departmentId) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/audit", requireAuth, async (req, res, next) => {
    try {
      const entry = req.body;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return res.status(400).json({ ok: false, error: "Entry must be an object" });
      }
      if (Buffer.byteLength(JSON.stringify(entry)) > MAX_AUDIT_BYTES) {
        return res.status(413).json({ ok: false, error: "Entry too large" });
      }
      // Stamp the real actor from the session, never trust a client-supplied one.
      const stamped = {
        ...entry,
        actor: {
          name: req.user.displayName || req.user.username || "Unknown",
          discordId: req.user.id || "",
          group: req.user.group || "",
        },
      };
      const departmentId = req.departmentId || resolveDepartmentId(req);
      res.json({ ok: true, data: await appendAudit(departmentId, stamped) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
