# Department Hub — Backend

An Express + MariaDB server that implements the contract in `src/lib/api.js`.
It runs as a **single service**: the same process serves the built front-end
(`dist/`) *and* the `/api` + `/auth` endpoints, so Discord-auth cookies stay
same-origin (simple `SameSite=Lax`, no CORS).

```
server/
  index.js            # express app: helmet, sessions, passport, routes, static dist/
  env.js              # reads .env / Railway vars into one typed config
  db.js               # mysql2 pool + migrations + config/audit data access
  auth.js             # Discord OAuth2 (passport-oauth2) + /auth routes
  permissions.js      # server-side capability checks (reuses src/lib/permissions.js)
  routes/
    config.js         # GET/PUT /api/config
    audit.js          # GET/POST /api/audit  (append-only, kept forever)
    roster.js         # POST /api/roster/sync  (Discord bot → rank update)
```

**One source of truth.** The server imports the *same* pure modules the
front-end uses — `src/lib/permissions.js` (capability checks), `src/lib/roster.js`
(rank sync), `src/config/defaultConfig.js` (seed config) — so the rules can
never drift between client and server.

---

## Run it locally

1. Bring up a MariaDB (any of: local install, Docker, or a Railway DB you
   connect to). Create a database, e.g. `department_hub`.
2. `cp .env.example .env` and fill in `DB_*` (or `DATABASE_URL`),
   `SESSION_SECRET`, and the Discord OAuth values.
3. Install + build + run:
   ```bash
   npm install
   npm run build        # builds the front-end into dist/
   npm run server       # node --watch server/index.js  (auto-restarts)
   ```
4. Open `http://localhost:3003`.

During UI development you can instead run the Vite dev server (`npm run dev`,
port 5173) alongside `npm run server` (port 3003) — `vite.config.js` already
proxies `/api` and `/auth` to 3003, so the front-end talks to the running server.

Tables are created automatically on first boot (`migrate()` in `db.js`):
`department_config`, `audit_log`, and a `sessions` table.

---

## Deploy on Railway (single service)

You'll have **two** Railway services in one project: a **MySQL** database and
this **app**.

### 1. Add the database
- In your Railway project: **New → Database → MySQL**. (MySQL is
  MariaDB-compatible for everything this app does.)
- It exposes `MYSQL_URL` / `MYSQLHOST` / `MYSQLUSER` / … automatically.

### 2. Configure the app service
This repo is already the app service (it's serving the front-end today). Add
these **Variables** (Settings → Variables):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{ MySQL.MYSQL_URL }}` (reference the DB service) |
| `SESSION_SECRET` | a long random string |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | from the Discord app |
| `DISCORD_GUILD_ID` | your department's Discord server id |
| `DISCORD_CALLBACK_URL` | `https://YOUR-APP.up.railway.app/auth/discord/callback` |
| `BOT_SYNC_SECRET` | a random string (only if you use the rank-sync bot) |
| `DISCORD_BOT_TOKEN` | optional bot token, lets the Admin Log resolve any member's guild display name from a Discord ID (see below) |

### First-login access
On login, a member's permission group is resolved from **role mappings**
(Access & Roles → a Discord role id linked to a group) or an explicit member
assignment. A brand-new config has none, so before the first real Discord login,
**seed the config** with at least one role mapping that grants access (e.g. map
your Management/Director Discord roles to the `management` group). Do this by
importing a prepared config backup into the DB, or by signing in once via the
gated `POST /auth/dev-login` (`DEV_LOGIN_ENABLED=true`) to configure Access &
Roles, then turning it back off. Admin-log moderation is reserved for the
**Management** group.

### Admin Log name lookup (optional)
When logging an entry, pasting a **Subject Discord ID** auto-fills the name. It
first matches the ID against people already in the roster or prior entries (free,
no setup). To resolve *anyone* in the guild — not just people already recorded —
set `DISCORD_BOT_TOKEN`: create a bot in the Discord Developer Portal, invite it
to your `DISCORD_GUILD_ID` server, and enable the **Server Members Intent**
(Bot → Privileged Gateway Intents). Without the token the roster fallback still
works; the app never blocks on the lookup.

`railway.json` already sets build = `npm run build` and start = `npm start`.
Railway injects `PORT`; the server reads it.

### 3. Point Discord at Railway
In the [Discord Developer Portal](https://discord.com/developers/applications)
→ your app → **OAuth2** → add the redirect URL:
```
https://YOUR-APP.up.railway.app/auth/discord/callback
```
It must match `DISCORD_CALLBACK_URL` exactly. Scopes used: `identify`,
`guilds.members.read`.

> **Roles are scanned across guilds.** On login the server reads the member's
> roles in the main `DISCORD_GUILD_ID` **and** in the department's own guild(s),
> set per-department under Administration → Access & Roles → "Department guild
> (server) ID" (comma-separate several). Role IDs from every guild are unioned
> before mapping to a permission group, so a department can grant access with
> its own server's roles. The display name prefers the department-guild
> nickname. This uses the same `guilds.members.read` scope — no bot needed.

### 4. Deploy
Push to the branch Railway tracks (or hit Deploy). Railway runs
`npm install` → `npm run build` → `npm start`. Visit the app URL and sign in
with Discord.

---

## Security notes (already wired)

These map to the README's backend checklist:

- **Capabilities re-checked server-side** on every protected route
  (`requireCapability`), using the same `src/lib/permissions.js` as the client.
- **Dev login disabled in production** — `/auth/dev-login` refuses unless
  `DEV_LOGIN_ENABLED` is on (auto-off when `NODE_ENV=production`).
- **CSRF**: cookies are `HttpOnly` + `SameSite=Lax` (+ `Secure` in prod) and
  mutating routes require a same-origin `Origin`/`Referer` (`sameOriginGuard`).
- **Bot sync is secret-authenticated**, never a user session
  (`Authorization: Bearer <BOT_SYNC_SECRET>`), and exempt from the cookie CSRF
  guard since it isn't cookie-authed.
- **Payloads validated**: `PUT /api/config` enforces object shape + a 4 MB cap;
  the audit actor is stamped from the session, never trusted from the body.
- **Audit log is append-only** — no update/delete route, kept forever.
- `helmet` sets security headers; `trust proxy` is on for Railway's TLS.

## Serving multiple departments (domain-based tenancy)

One deployment + one database can serve every department; the server picks which
config to return from the **request hostname**:

```
fhp.ssrp.gg  → department "fhp"   (its own config + audit rows)
tpd.ssrp.gg  → department "tpd"
hcso.ssrp.gg → department "hcso"
```

The front-end needs **no changes** — each site just calls `/api/config` and the
server answers with that host's config. Resolution (see `server/tenant.js`):

1. an explicit `DEPARTMENT_MAP` entry for the host (`fhp.ssrp.gg=fhp,…`)
2. otherwise the first DNS label of a real subdomain (`fhp.ssrp.gg` → `fhp`)
3. otherwise `DEPARTMENT_ID` (the Railway URL, `localhost`, apex domains)

So you have two equivalent ways to run it:

- **One deploy, many domains** — point each department's subdomain at this one
  service (add the custom domains in Railway → Settings → Networking), optionally
  set `DEPARTMENT_MAP`, and each subdomain gets its own isolated config. New
  departments are created by an admin opening that subdomain and configuring the
  Builder (or by seeding a config row directly). No code or redeploy needed.
- **One deploy per department** — give each Railway service its own
  `DEPARTMENT_ID` (and optionally its own DB). Same code, fully isolated. This is
  the simplest model and needs nothing beyond the env var.

Both use the exact same code; it's purely how you point domains / set env vars.

> **Discord OAuth across subdomains:** the callback URL must match the host the
> user started on. For multiple subdomains, either register each subdomain's
> `/auth/discord/callback` in the Discord app, or route all logins through one
> central auth domain. (Doesn't affect dev login, which is per-subdomain.)

Bot rank-sync (`POST /api/roster/sync`) isn't tied to a hostname, so include the
target department in the body: `{ discordId, roleIds, departmentId }` (falls back
to the host / `DEPARTMENT_ID`).

## Moving onto another stack

Everything department-specific lives in env vars, and all DB access is in
`db.js`. To move onto a different MariaDB/Express setup: point the `DB_*` /
`DATABASE_URL` vars at that instance — that's it. To fold into an existing Express
app, the route modules in `routes/` (plus `auth.js`) drop in as routers; you only
need to provide a session store and the same env vars.
