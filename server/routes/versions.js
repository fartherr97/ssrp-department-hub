/*
 * Version history (config snapshots) — backs src/lib/api.js getVersions/pushVersion.
 *
 *   GET  /api/versions  → recent config snapshots (newest first)
 *   POST /api/versions  → store a snapshot (the client posts the new config +
 *                         the human summary it already computed for the audit log)
 *
 * Restoring a version is just a normal PUT /api/config of that snapshot, so it
 * goes through the same authorization as any other save — a stored snapshot can
 * never be used to escalate privileges on restore.
 */
import { Router } from "express";
import { loadVersions, loadVersion, appendVersion } from "../db.js";
import { requireAuth, requireCapability } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import {
  canManageSite,
  canManageAccess,
  canEditAnyRoster,
  hasCapability,
} from "../../src/lib/permissions.js";
import { currentConfig } from "./config.js";

const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;

function canWrite(user, config) {
  return (
    canManageSite(user, config) ||
    canManageAccess(user, config) ||
    canEditAnyRoster(user, config) ||
    hasCapability(user, config, "editRosterLimited") ||
    hasCapability(user, config, "manageCalendar") ||
    hasCapability(user, config, "manageLogs")
  );
}

export function versionsRouter() {
  const router = Router();

  // The LIST is metadata only (who / when / what changed — no snapshot bodies),
  // so viewing it just needs the "View version history" capability. The full
  // snapshots (with member Discord ids and webhook secrets) are guarded
  // separately on /versions/:id below.
  router.get(
    "/versions",
    requireCapability(
      "viewVersionHistory",
      (req) => currentConfig(req.departmentId || resolveDepartmentId(req))
    ),
    async (req, res, next) => {
      try {
        const departmentId = req.departmentId || resolveDepartmentId(req);
        res.json({ ok: true, data: await loadVersions(departmentId) });
      } catch (err) {
        next(err);
      }
    }
  );

  // One version's full config snapshot — a FULL config document (member Discord
  // ids, webhook secrets and all), fetched only when restoring. Restoring is a
  // manage-site action (it re-grants permissions), so this stays manage-site —
  // keeping whole-config secrets out of reach of version-history viewers.
  router.get(
    "/versions/:id",
    requireCapability(
      "manageSite",
      (req) => currentConfig(req.departmentId || resolveDepartmentId(req))
    ),
    async (req, res, next) => {
      try {
        const departmentId = req.departmentId || resolveDepartmentId(req);
        const id = String(req.params.id || "").replace(/\D/g, "");
        if (!id) return res.status(400).json({ ok: false, error: "Invalid version id" });
        const config = await loadVersion(departmentId, id);
        if (!config) return res.status(404).json({ ok: false, error: "Version not found" });
        res.json({ ok: true, data: { config } });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post("/versions", requireAuth, async (req, res, next) => {
    try {
      const departmentId = req.departmentId || resolveDepartmentId(req);
      const config = await currentConfig(departmentId);
      if (!canWrite(req.user, config)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
      }
      const v = req.body || {};
      if (!v.config || typeof v.config !== "object") {
        return res.status(400).json({ ok: false, error: "Snapshot required" });
      }
      if (Buffer.byteLength(JSON.stringify(v.config)) > MAX_SNAPSHOT_BYTES) {
        return res.status(413).json({ ok: false, error: "Snapshot too large" });
      }
      // Stamp the actor from the session, never trust the client's.
      const actor = {
        name: req.user.displayName || req.user.username || "Unknown",
        discordId: req.user.id || "",
        group: req.user.group || "",
      };
      const saved = await appendVersion(departmentId, { ...v, actor });
      res.json({ ok: true, data: saved });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
