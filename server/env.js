/*
 * Environment loader. Reads .env (via dotenv) and exposes a single typed config
 * object. Throwing here on missing critical values is intentional — better to
 * fail fast on boot than to half-start a server that can't authenticate.
 *
 * On Railway you don't ship a .env file; you set these as service Variables and
 * Railway injects them. Locally, copy .env.example → .env and fill it in.
 */
import "dotenv/config";

function bool(v, fallback = false) {
  if (v == null) return fallback;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

// Parse "host=id,host2=id2" (or a JSON object) into a lowercased host → id map.
function parseDepartmentMap(raw) {
  if (!raw) return {};
  const trimmed = String(raw).trim();
  try {
    if (trimmed.startsWith("{")) {
      const obj = JSON.parse(trimmed);
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k.toLowerCase().trim()] = String(v).trim();
      return out;
    }
  } catch {
    /* fall through to csv parsing */
  }
  const out = {};
  for (const pair of trimmed.split(",")) {
    const [host, id] = pair.split("=");
    if (host && id) out[host.toLowerCase().trim()] = id.trim();
  }
  return out;
}

// Railway provides MySQL/MariaDB credentials as MYSQL* and also a MYSQL_URL.
// Support both those and the DB_* names from .env.example so either works.
const db = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || "root",
  password:
    process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? process.env.MYSQL_PASSWORD ?? "",
  database:
    process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "department_hub",
  url: process.env.DATABASE_URL || process.env.MYSQL_URL || "",
};

export const env = {
  port: Number(process.env.PORT || 3003),
  isProd: process.env.NODE_ENV === "production",

  // The default department id for this deployment (used when the request's host
  // doesn't map to a specific department — e.g. the Railway URL, or a
  // deploy-per-department setup). Config is stored keyed by department id.
  departmentId: process.env.DEPARTMENT_ID || process.env.DISCORD_GUILD_ID || "default",

  // Optional explicit hostname → department-id map for domain-based tenancy.
  // Format: "fhp.ssrp.gg=fhp,tpd.ssrp.gg=tpd" (also accepts JSON). Hosts not
  // listed fall back to the subdomain label, then to departmentId.
  departmentMap: parseDepartmentMap(process.env.DEPARTMENT_MAP),

  session: {
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    // Set false to allow dev login to work over plain http locally; true on
    // Railway (which terminates TLS in front of the app — see trust proxy).
    secureCookie: bool(process.env.SECURE_COOKIES, process.env.NODE_ENV === "production"),
  },

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    callbackUrl:
      process.env.DISCORD_CALLBACK_URL || "http://localhost:3003/auth/discord/callback",
    guildId: process.env.DISCORD_GUILD_ID || "",
    // Optional bot token. When set (bot in the guild + Server Members Intent),
    // the app can resolve any member's guild display name by Discord ID, e.g.
    // to auto-fill the subject of an Admin Log entry.
    botToken: process.env.DISCORD_BOT_TOKEN || "",
  },

  // Shared secret the Discord bot sends on POST /api/roster/sync. The bot is NOT
  // a logged-in user, so it authenticates with this instead of a session.
  botSyncSecret: process.env.BOT_SYNC_SECRET || "",

  // Lets the front-end dev login work against the real backend for testing.
  // Fail-closed: OFF unless DEV_LOGIN_ENABLED is explicitly truthy (previously it
  // defaulted ON whenever NODE_ENV wasn't "production", which silently exposed an
  // admin-minting endpoint on any deploy that forgot to set NODE_ENV).
  devLoginEnabled: bool(process.env.DEV_LOGIN_ENABLED, false),

  db,
};

export function assertDiscordConfigured() {
  const missing = [];
  if (!env.discord.clientId) missing.push("DISCORD_CLIENT_ID");
  if (!env.discord.clientSecret) missing.push("DISCORD_CLIENT_SECRET");
  if (!env.discord.guildId) missing.push("DISCORD_GUILD_ID");
  return missing;
}
