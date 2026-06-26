/*
 * Department Hub — backend server (single service).
 *
 * One Express process does everything:
 *   • /api/*  and /auth/*  → the REST + OAuth contract from src/lib/api.js
 *   • everything else       → the built front-end (dist/), SPA-style
 *
 * Running front-end and API on one origin keeps the Discord-auth cookies simple
 * (SameSite=Lax, no CORS) — the recommended Railway topology.
 *
 *   npm run build   # vite build → dist/
 *   npm start       # node server/index.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import passport from "passport";
import MySQLStoreFactory from "express-mysql-session";

import { env } from "./env.js";
import { getPool, migrate } from "./db.js";
import { mountAuthRoutes } from "./auth.js";
import { configRouter } from "./routes/config.js";
import { auditRouter } from "./routes/audit.js";
import { rosterRouter } from "./routes/roster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

/*
 * Lightweight CSRF defense for a cookie-authed, same-origin API: require that
 * mutating requests come from our own origin (Origin/Referer check). A real
 * cross-site form/script can't forge these headers, and browsers send them
 * automatically. Combined with SameSite=Lax cookies this covers the contract's
 * CSRF requirement without the front-end needing to manage a token.
 */
function sameOriginGuard(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  // Bot sync authenticates with a secret header, not a cookie — exempt it.
  if (req.path === "/roster/sync") return next();
  const origin = req.get("origin") || req.get("referer") || "";
  const host = req.get("host") || "";
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return next();
    } catch {
      /* fall through to reject */
    }
  }
  return res.status(403).json({ ok: false, error: "Cross-origin request blocked" });
}

async function main() {
  await migrate();

  const app = express();
  // Railway terminates TLS in front of us; trust the proxy so Secure cookies and
  // req.protocol work correctly.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // The SPA inlines styles and loads media/images from arbitrary URLs the
      // departments configure, so a strict CSP would break the builder. The
      // front-end already sanitizes URLs at render (src/lib/urls.js).
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(express.json({ limit: "5mb" }));

  // Session, persisted in MariaDB so logins survive restarts/redeploys.
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore(
    { createDatabaseTable: true, clearExpired: true },
    getPool()
  );
  app.use(
    session({
      name: "hub.sid",
      secret: env.session.secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.session.secureCookie,
        maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes (/auth/*).
  mountAuthRoutes(app);

  // API routes (/api/*), behind the same-origin guard.
  const api = express.Router();
  api.use(sameOriginGuard);
  api.use(configRouter());
  api.use(auditRouter());
  api.use(rosterRouter());
  app.use("/api", api);

  app.get("/api/health", (_req, res) => res.json({ ok: true, data: "up" }));

  // Static front-end + SPA fallback (anything not /api or /auth).
  app.use(express.static(distDir));
  app.get(/^(?!\/(api|auth)\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });

  // JSON error handler — never leak stack traces to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("[server] error:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  });

  app.listen(env.port, () => {
    console.log(`Department Hub server listening on :${env.port}`);
    console.log(`  department: ${env.departmentId}`);
    console.log(`  dev login:  ${env.devLoginEnabled ? "ENABLED" : "disabled"}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
