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

  // Which department/guild this deployment serves. The config is stored keyed by
  // this id, so one DB could host several departments if you ever need to.
  departmentId: process.env.DEPARTMENT_ID || process.env.DISCORD_GUILD_ID || "default",

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
  },

  // Shared secret the Discord bot sends on POST /api/roster/sync. The bot is NOT
  // a logged-in user, so it authenticates with this instead of a session.
  botSyncSecret: process.env.BOT_SYNC_SECRET || "",

  // Lets the front-end dev login work against the real backend during local
  // testing. MUST be off in production — never issue a session without OAuth.
  devLoginEnabled: bool(process.env.DEV_LOGIN_ENABLED, process.env.NODE_ENV !== "production"),

  db,
};

export function assertDiscordConfigured() {
  const missing = [];
  if (!env.discord.clientId) missing.push("DISCORD_CLIENT_ID");
  if (!env.discord.clientSecret) missing.push("DISCORD_CLIENT_SECRET");
  if (!env.discord.guildId) missing.push("DISCORD_GUILD_ID");
  return missing;
}
