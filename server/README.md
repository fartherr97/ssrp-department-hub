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
  auth.js             # passport-discord OAuth + /auth routes
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
proxies `/api` and `/auth` to 3003. Set `VITE_USE_BACKEND=true` so the
front-end talks to the server instead of localStorage.

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
| `VITE_USE_BACKEND` | `true` — **build-time** flag so the front-end calls the API |

`railway.json` already sets build = `npm run build` and start = `npm start`.
Railway injects `PORT`; the server reads it.

> `VITE_USE_BACKEND` must be present **when `npm run build` runs** (Vite inlines
> it). On Railway, service Variables are available at build time, so just set it.

### 3. Point Discord at Railway
In the [Discord Developer Portal](https://discord.com/developers/applications)
→ your app → **OAuth2** → add the redirect URL:
```
https://YOUR-APP.up.railway.app/auth/discord/callback
```
It must match `DISCORD_CALLBACK_URL` exactly. Scopes used: `identify`,
`guilds.members.read`.

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

## Handing off to Steve's stack

Everything department-specific lives in env vars, and all DB access is in
`db.js`. To move onto a different MariaDB/Express setup: point the `DB_*` /
`DATABASE_URL` vars at his instance — that's it. If he has an existing Express
app, the four route modules in `routes/` (plus `auth.js`) drop in as routers; he
only needs to provide a session store and the same env vars.
