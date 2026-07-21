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
import rateLimit from "express-rate-limit";
import MySQLStoreFactory from "express-mysql-session";

import { env } from "./env.js";
import { getSessionPool, migrate } from "./db.js";
import { mountAuthRoutes } from "./auth.js";
import { configRouter } from "./routes/config.js";
import { auditRouter } from "./routes/audit.js";
import { rosterRouter } from "./routes/roster.js";
import { versionsRouter } from "./routes/versions.js";
import { hoursRouter } from "./routes/hours.js";
import { logsRouter } from "./routes/logs.js";
import { aiRouter } from "./routes/ai.js";
import { tenantMiddleware } from "./tenant.js";
import { isSameOrigin } from "./security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

/*
 * Lightweight CSRF defense for a cookie-authed, same-origin API: require that
 * mutating requests come from our own origin (Origin/Referer check). A real
 * cross-site form/script can't forge these headers, and browsers send them
 * automatically. Combined with SameSite=Lax cookies this covers the contract's
 * CSRF requirement without the front-end needing to manage a token.
 */
// ── Rate limiters ────────────────────────────────────────────────────────────
// Keyed by client IP (trust proxy is set, so this is the real client on Railway).
// Limits are generous enough for normal use + the dev demo, but cap brute-force
// and scraping. Each responds with our standard JSON error shape on 429.
const limitReached = (_req, res) =>
  res.status(429).json({ ok: false, error: "Too many requests, slow down." });

// Broad ceiling for the whole API surface (read-heavy: config polling, roster).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReached,
});

// Login/session minting — the classic brute-force target. Only counts failures
// isn't supported cleanly, so we cap total auth POSTs per window instead.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReached,
});

// Bot feed endpoints (roster sync / duty hours) authenticate with a shared
// secret; cap them so a leaked secret can't be used to hammer the DB.
const botLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitReached,
});

function sameOriginGuard(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  // Bot/feed endpoints authenticate with a secret header, not a cookie — exempt.
  if (req.path === "/roster/sync" || req.path === "/hours") return next();
  if (isSameOrigin(req)) return next();
  return res.status(403).json({ ok: false, error: "Cross-origin request blocked" });
}

// Retry the first DB connection a few times — on Railway the private network
// (and the DB itself) can take a few seconds to be reachable after a deploy, and
// we'd rather wait briefly than crash-loop.
async function migrateWithRetry(attempts = 6) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await migrate();
      return;
    } catch (err) {
      const last = i === attempts;
      if (err?.code === "ECONNREFUSED" && env.db.host === "localhost" && !env.db.url) {
        console.error(
          "\n[db] Could not reach a database at localhost:3306, and no " +
            "DATABASE_URL / DB_* variables are set.\n" +
            "     On Railway: open this service → Variables → add\n" +
            "       DATABASE_URL = ${{ MySQL.MYSQL_URL }}\n" +
            "     (replace 'MySQL' with your database service's name), then redeploy.\n"
        );
        process.exit(1); // misconfiguration, not transient — don't spin
      }
      console.warn(`[db] connection attempt ${i}/${attempts} failed (${err?.code || err?.message}).`);
      if (last) throw err;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (i - 1), 8000)));
    }
  }
}

// Refuse to boot a production deploy with a weak/default session secret. The
// session cookie is signed with this value; the placeholder is public (it's in
// .env.example), so shipping it would let anyone forge sessions. Fail fast rather
// than half-start an insecure server.
function assertProdSecrets() {
  if (!env.isProd) return;
  const secret = env.session.secret;
  if (!process.env.SESSION_SECRET || !secret || secret === "change-me-in-production") {
    console.error(
      "\n[boot] Refusing to start in production without a real SESSION_SECRET.\n" +
        "       Set SESSION_SECRET to a long random string (e.g. `openssl rand -hex 32`)\n" +
        "       in this service's Variables, then redeploy.\n"
    );
    process.exit(1);
  }
}

async function main() {
  assertProdSecrets();
  await migrateWithRetry();

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
    getSessionPool()
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

  // Auth routes (/auth/*). POSTs (login/dev-login/logout) are rate-limited to
  // blunt brute force; the GET redirects to Discord are cheap and left alone.
  app.use("/auth", (req, res, next) =>
    req.method === "POST" ? authLimiter(req, res, next) : next()
  );
  mountAuthRoutes(app);

  // API routes (/api/*), behind the same-origin guard. tenantMiddleware stamps
  // req.departmentId from the request hostname (domain-based multi-tenancy).
  const api = express.Router();
  // Bot endpoints get their own (higher) budget; everything else shares apiLimiter.
  api.use((req, res, next) =>
    req.path === "/roster/sync" || req.path === "/hours"
      ? botLimiter(req, res, next)
      : apiLimiter(req, res, next)
  );
  api.use(sameOriginGuard);
  api.use(tenantMiddleware);
  api.use(configRouter());
  api.use(auditRouter());
  api.use(rosterRouter());
  api.use(versionsRouter());
  api.use(hoursRouter());
  api.use(logsRouter());
  api.use(aiRouter());
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
