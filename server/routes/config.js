/*
 * Config endpoints — the heart of the contract (src/lib/api.js getConfig/saveConfig).
 *
 *   GET  /api/config  → the department's config object (seeded from the
 *                       boilerplate default on first ever read)
 *   PUT  /api/config  → replace it (requires manage-site)
 *
 * Reads are open to any signed-in member (the front-end needs the config to
 * render). Writes require the manageSite capability, re-checked server-side.
 */
import { Router } from "express";
import { env } from "../env.js";
import { loadConfig, saveConfig } from "../db.js";
import { requireCapability, canManageSite } from "../permissions.js";
import { cloneDefaultConfig } from "../../src/config/defaultConfig.js";

const MAX_CONFIG_BYTES = 4 * 1024 * 1024; // 4 MB ceiling on a single config doc

// Get the live config, seeding defaults the first time this department loads.
export async function currentConfig() {
  let config = await loadConfig(env.departmentId);
  if (!config) {
    config = cloneDefaultConfig();
    await saveConfig(env.departmentId, config);
  }
  return config;
}

export function configRouter() {
  const router = Router();

  // Public: the front-end needs the config to render the login screen itself
  // (branding, theme) before anyone is signed in, mirroring the localStorage
  // mock which always returns it. Writes are still gated below.
  router.get("/config", async (_req, res, next) => {
    try {
      res.json({ ok: true, data: await currentConfig() });
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/config",
    requireCapability("manageSite", currentConfig),
    async (req, res, next) => {
      try {
        const incoming = req.body;
        // Validate shape + size before trusting the payload (README checklist).
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          return res.status(400).json({ ok: false, error: "Config must be an object" });
        }
        if (Buffer.byteLength(JSON.stringify(incoming)) > MAX_CONFIG_BYTES) {
          return res.status(413).json({ ok: false, error: "Config too large" });
        }
        const saved = await saveConfig(env.departmentId, incoming);
        res.json({ ok: true, data: saved });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export { canManageSite };
