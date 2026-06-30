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
import { requireAuth } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";

export function auditRouter() {
  const router = Router();

  router.get("/audit", requireAuth, async (req, res, next) => {
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
