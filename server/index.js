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
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import passport from "passport";
import rateLimit from "express-rate-limit";
import MySQLStoreFactory from "express-mysql-session";

import { env } from "./env.js";
import { getSessionPool, migrate } from "./db.js";
import { mountAuthRoutes } from "./auth.js";
import { configRouter, currentConfig } from "./routes/config.js";
import { hydrateSessionUser } from "./permissions.js";
import { auditRouter } from "./routes/audit.js";
import { rosterRouter } from "./routes/roster.js";
import { versionsRouter } from "./routes/versions.js";
import { hoursRouter } from "./routes/hours.js";
import { logsRouter } from "./routes/logs.js";
import { discordRouter } from "./routes/discord.js";
import { tenantMiddleware, resolveDepartmentId } from "./tenant.js";
import { isSameOrigin } from "./security.js";
import { helmetOptions } from "./httpSecurity.js";

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

// Mutating API calls (config/roster/version writes) — a much tighter budget than
// the read ceiling. A whole-config PUT is expensive (parse + serialize a doc up
// to 16 MB), so this blunts write floods and accidental save loops per client IP.
// Headroom note: one builder "save" fans out to PUT /config + POST /versions +
// POST /audit, so keep this comfortably above the human save rate.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
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
// session cookie is signed with this value; any placeholder is public (it's in
// the repo / docs), so shipping it would let anyone forge sessions. We reject by
// PROPERTY (known placeholders + a length floor) rather than by matching one
// historical string, so a new example value can't quietly slip past the guard.
const WEAK_SESSION_SECRETS = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "changeme",
  "secret",
  "password",
  "dev",
  "development",
  "test",
]);
function assertProdSecrets() {
  if (!env.isProd) return;
  const secret = (process.env.SESSION_SECRET || "").trim();
  const tooShort = secret.length < 32; // e.g. `openssl rand -hex 32` → 64 chars
  if (!secret || WEAK_SESSION_SECRETS.has(secret.toLowerCase()) || tooShort) {
    console.error(
      "\n[boot] Refusing to start in production without a strong SESSION_SECRET.\n" +
        "       It must be a long random string of at least 32 characters and must\n" +
        "       not be a known placeholder. Generate one:\n" +
        '         node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"\n' +
        "       Set it in this service's Variables, then redeploy.\n"
    );
    process.exit(1);
  }
}

async function main() {
  assertProdSecrets();
  await migrateWithRetry();

  const app = express();
  // Railway terminates TLS in front of us; trust the proxy so Secure cookies and
  // req.protocol work correctly. The HOP COUNT matters for security: rate limits
  // are keyed by req.ip, and if this is looser than the real number of proxies in
  // front, a client could spoof X-Forwarded-For to forge its IP and dodge the
  // limits. Default 1 (Railway's single edge proxy); override TRUST_PROXY only if
  // your topology actually has more hops. Never set it to `true` in production.
  app.set("trust proxy", env.trustProxy);

  app.use(helmet(helmetOptions()));
  // Body cap sits just above the 16 MB config document ceiling (MAX_CONFIG_BYTES)
  // so a version snapshot's wrapper fits, while still rejecting oversized payloads
  // early instead of buffering 20 MB of attacker JSON per request.
  app.use(express.json({ limit: "17mb" }));

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
      // rolling: the maxAge is an IDLE timeout — each response resets the clock,
      // so active users stay signed in but an abandoned session expires after 7
      // days of inactivity (shorter stolen-cookie window than a fixed 14 days).
      // Note: a user's PRIVILEGES are re-derived from the live config on every
      // request (hydrateSessionUser), so demoting someone takes effect on their
      // very next request regardless of how long the session cookie lives.
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.session.secureCookie,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days idle
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
  // Throttle mutating requests harder than the broad read ceiling — config PUTs
  // are whole-document writes and the classic abuse target.
  api.use((req, res, next) =>
    (req.method === "POST" || req.method === "PUT") &&
    req.path !== "/roster/sync" &&
    req.path !== "/hours"
      ? writeLimiter(req, res, next)
      : next()
  );
  api.use(sameOriginGuard);
  api.use(tenantMiddleware);
  // Re-derive who the caller is (group, isAdmin) from the CURRENT department's
  // config on every request, and reject a session minted for another tenant.
  // Must run after tenantMiddleware (needs req.departmentId) and before routers.
  api.use(hydrateSessionUser((req) => currentConfig(req.departmentId || resolveDepartmentId(req))));
  api.use(configRouter());
  api.use(auditRouter());
  api.use(rosterRouter());
  api.use(versionsRouter());
  api.use(hoursRouter());
  api.use(logsRouter());
  api.use(discordRouter());
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

// Only auto-boot when run directly (node server/index.js), so the module can be
// imported by tests without starting the server / touching the DB.
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}

export { assertProdSecrets, main };
