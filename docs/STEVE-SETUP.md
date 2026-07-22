# Department Hub — Setup & Handoff Guide (for Steve)

This is everything you need to stand up the Department Hub from scratch: the
MariaDB database, the app service, Discord OAuth, and the one-time seeding that
grants Management access on first login. It's written so you can follow it
top-to-bottom without touching the code.

> **What this app is:** one Express server that serves both the built front-end
> (`dist/`) **and** the `/api` + `/auth` endpoints from the same origin, backed
> by MariaDB. There is no separate frontend host and no CORS to configure — one
> web service + one database.

---

## 0. What you'll end up with

- **One database** (MariaDB / MySQL) — this app is MariaDB-compatible.
- **One web service** running this repo (`npm install → npm run build → npm start`).
- **One Discord application** (OAuth) so members sign in with Discord.
- Optionally **one Discord bot token** (only for the Admin Log name lookup).

The app auto-creates its own tables on first boot, so you do **not** hand-write
any schema. More on that in §2.

---

## 1. MariaDB

You can use a Railway MySQL plugin **or** your own MariaDB instance — the app
supports both. It only needs a database and a user that can create tables in it.

### 1a. Provision the database
- **Railway:** project → **New → Database → MySQL**. Railway exposes
  `MYSQL_URL`, `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`,
  `MYSQLPORT` automatically. MySQL is fully MariaDB-compatible for everything
  this app does.
- **Your own MariaDB:** create a database and a user, e.g.
  ```sql
  CREATE DATABASE department_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'department_hub'@'%' IDENTIFIED BY 'a-strong-password';
  GRANT ALL PRIVILEGES ON department_hub.* TO 'department_hub'@'%';
  FLUSH PRIVILEGES;
  ```
  The user needs `CREATE`, `INDEX`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on
  that database (the `GRANT ALL … ON department_hub.*` above covers it). No
  server-wide/superuser rights required.

### 1b. Point the app at it — two equivalent ways
1. **A single URL (recommended):** set `DATABASE_URL` to a MySQL connection
   string. On Railway, reference the DB service: `DATABASE_URL=${{ MySQL.MYSQL_URL }}`.
   Format for your own box:
   ```
   mysql://USER:PASSWORD@HOST:3306/department_hub
   ```
2. **Discrete fields:** leave `DATABASE_URL` blank and set `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

If both are present, `DATABASE_URL` wins. (Railway's native `MYSQL*` names are
also read automatically, so a Railway MySQL plugin often needs no DB config at
all beyond referencing the URL.)

### 1c. Tables are created automatically
On first boot the app runs `migrate()` and creates any missing tables — **you
never run migrations by hand.** The tables:

| Table | Purpose |
| --- | --- |
| `department_config` | one JSON config document per department (branding, roster, pages, groups, role mappings) |
| `audit_log` | append-only activity history (who changed what) — never updated or deleted |
| `config_versions` | full config snapshots for version history / restore |
| `sessions` | login sessions (created by the session store on boot) |

Re-running is safe (`CREATE TABLE IF NOT EXISTS`), so redeploys never clobber
data. Backups: back up these four tables like any MariaDB data; the whole app
state lives in them.

---

## 2. Environment variables

Set these on the **app** service (Railway → Settings → Variables, or your
`.env` if self-hosting). Copy `.env.example` for the annotated version.

### Required in production
| Variable | Value / notes |
| --- | --- |
| `NODE_ENV` | `production` (enables Secure cookies, disables dev login, enforces the checks below) |
| `DATABASE_URL` | MySQL/MariaDB connection string (or use the `DB_*` fields from §1b) |
| `SESSION_SECRET` | long random string — **the server refuses to boot in production** if this is unset, a known placeholder, or shorter than 32 chars. Generate one: `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `DISCORD_CLIENT_ID` | from the Discord app (§3) |
| `DISCORD_CLIENT_SECRET` | from the Discord app (§3) |
| `DISCORD_GUILD_ID` | the main SSRP Discord server (guild) ID |
| `DISCORD_CALLBACK_URL` | `https://YOUR-APP.up.railway.app/auth/discord/callback` — must match the Discord app's redirect **exactly** |

### Recommended / situational
| Variable | Value / notes |
| --- | --- |
| `TRUST_PROXY` | number of reverse proxies in front of the app. Default `1` (Railway's single edge proxy) is correct for Railway. Rate limits are keyed by client IP, so this must match your real topology — **never set `true` in production.** |
| `DEPARTMENT_ID` | default department id for this deploy (falls back to `DISCORD_GUILD_ID`, then `default`). Only matters for single-department deploys or the Railway URL. |
| `DEPARTMENT_MAP` | domain-based multi-tenancy: `fhp.ssrp.gg=fhp,tpd.ssrp.gg=tpd`. Leave blank for a single department. See §6. |
| `SECURE_COOKIES` | auto-on when `NODE_ENV=production`; only set to force it. |

### Optional features
| Variable | Value / notes |
| --- | --- |
| `DISCORD_BOT_TOKEN` | lets the Admin Log resolve **any** guild member's display name from a Discord ID. Without it, the roster/prior-entry fallback still works. Requires a bot in the guild with **Server Members Intent** on (§3c). |
| `BOT_SYNC_SECRET` | shared secret the rank-sync bot sends as `Authorization: Bearer <secret>` on `POST /api/roster/sync` and `POST /api/hours`. Leave blank (and set no map) to disable those endpoints entirely. |
| `BOT_SYNC_SECRET_MAP` | per-department bot secrets: `fhp=secretA,tpd=secretB`. Prefer this over a single global secret so one leak can't write every tenant. |
| `DEV_LOGIN_ENABLED` | **leave OFF/blank in production.** Only turn on temporarily for the seeding trick in §4b, then turn it back off. |

> **Build-time flag:** the front-end must be built with `VITE_USE_BACKEND=true`
> so it calls the API instead of a local mock. On Railway, service Variables are
> available at build time, so just add `VITE_USE_BACKEND=true` as a Variable and
> it's inlined when `npm run build` runs. (If you build locally/CI, export it
> before `npm run build`.)

---

## 3. Discord OAuth (and optional bot)

### 3a. Create the OAuth app
1. <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2** → copy **Client ID** and **Client Secret** → these are
   `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`.
3. **OAuth2 → Redirects → Add Redirect**, paste exactly:
   ```
   https://YOUR-APP.up.railway.app/auth/discord/callback
   ```
   This must equal `DISCORD_CALLBACK_URL`. (Running multiple subdomains? Add one
   redirect per subdomain, or route all logins through one auth domain.)
4. Scopes the app requests: `identify`, `guilds.members.read`. Nothing to toggle
   here — the app asks for them at login. `guilds.members.read` is what lets it
   read each member's nickname + roles for group mapping, **no bot needed**.

### 3b. Get the guild ID
Enable Developer Mode in Discord (User Settings → Advanced), right-click the
main SSRP server → **Copy Server ID**. That's `DISCORD_GUILD_ID`.

> **Roles are scanned across guilds.** On login the server reads a member's
> roles in the main `DISCORD_GUILD_ID` **and** in each department's own guild(s)
> (set per-department under Access & Roles → "Department guild (server) ID",
> comma-separate several). Role IDs from every guild are unioned before mapping
> to a group — so a department can grant access with its own server's roles.

### 3c. Optional bot token (Admin Log name lookup only)
Only if you want the Admin Log to resolve *anyone* in the guild by Discord ID
(not just people already in the roster):
1. Same Discord app → **Bot → Add Bot** → copy the token → `DISCORD_BOT_TOKEN`.
2. **Bot → Privileged Gateway Intents → enable Server Members Intent.**
3. Invite the bot to the `DISCORD_GUILD_ID` server.
Skip this entirely and the app still works — it just falls back to the roster.

---

## 4. First-login access (IMPORTANT — do this before launch)

Permission groups are resolved from **role mappings**: a Discord role ID linked
to a permission group. A brand-new config has an **empty** `roleMappings` list,
so if you deploy and log in with Discord before seeding one, nobody lands in a
privileged group and you're locked out of the Builder. Seed it first.

### What to seed
Map the two staff roles to the **`management`** group (the top of the hierarchy;
Management is what's hardcoded to moderate Admin Logs — see §7):

| Discord role | Role ID | → Group |
| --- | --- | --- |
| Director Team | `1493168294134419526` | `management` |
| Management team | `507371705774374915` | `management` |

In config terms, `auth.roleMappings` should contain:
```json
{ "roleId": "1493168294134419526", "roleName": "Director Team", "group": "management" }
{ "roleId": "507371705774374915", "roleName": "Management team", "group": "management" }
```

### Two ways to seed it

**4a. Seed the DB row directly (cleanest for production).**
Insert/patch the department's config document so `auth.roleMappings` includes the
two entries above, then deploy with dev login OFF. If you're starting from the
built-in default config, only `auth.roleMappings` needs those two rows — the
`management` group already exists with Manage Site. A member holding either
Discord role then logs in and immediately has full access; they finish the rest
(other groups, branding, roster) in Access & Roles.

**4b. Use dev login once, then disable it.**
1. Temporarily set `DEV_LOGIN_ENABLED=true` (and keep `NODE_ENV` as-is — dev
   login is same-origin guarded and only grants the chosen group's real
   capabilities, no magic admin).
2. Open the site, dev-login as `management`, go to **Administration → Access &
   Roles**, add the two role mappings above.
3. **Set `DEV_LOGIN_ENABLED=false` (or remove it) and redeploy.** Real Discord
   logins now resolve through the mappings.

Either way, once one Management/Director person can log in via Discord, they
manage everything else in the UI.

---

## 5. Deploy

### On Railway
1. Two services in one project: the **MySQL** database (§1) and this **app**.
2. Set the app's Variables (§2), including `VITE_USE_BACKEND=true`.
3. `railway.json` already sets build = `npm run build`, start = `npm start`.
   Railway runs `npm install → npm run build → npm start` and injects `PORT`.
4. Add the Discord redirect (§3a), seed access (§4), deploy, visit the app URL,
   sign in with Discord.

### On your own box
```bash
npm install
VITE_USE_BACKEND=true npm run build   # builds the front-end into dist/
npm start                             # serves dist/ + /api + /auth on PORT (default 3003)
```
Put it behind your reverse proxy (TLS terminating), set `TRUST_PROXY` to the
real hop count, and point `DISCORD_CALLBACK_URL` at your public URL.

---

## 6. Multi-department (optional)

One deploy + one database can serve every department; the server picks the
config by **request hostname**:
- `DEPARTMENT_MAP=fhp.ssrp.gg=fhp,tpd.ssrp.gg=tpd` (explicit), else the first
  subdomain label (`fhp.ssrp.gg → fhp`), else `DEPARTMENT_ID`.
- Add each department's custom domain in Railway → Settings → Networking, and
  register each subdomain's `/auth/discord/callback` in the Discord app.
- Each department gets its own isolated config + audit rows. Nothing to redeploy
  when adding a department — an admin opens the subdomain and configures it.

Prefer isolation per department? Give each its own deploy with its own
`DEPARTMENT_ID` (and optionally its own DB). Same code either way.

---

## 7. Security behavior worth knowing (already enforced server-side)

You don't configure these — they're baked in — but you should know them:

- **Server-authoritative auth.** Sessions are bound to their department; the
  group and admin status are re-derived from the live config on every request
  (no stale/cross-tenant privilege).
- **Admin Log moderation is Management-only.** Anyone with "Write
  administrative logs" can add entries and edit/delete **their own**, but
  editing/deleting **anyone's** entry is hardcoded to the **Management** group —
  it is not a toggle. This is why the two staff roles map to `management`.
- **Hierarchy is locked.** Groups are ordered by level; a lower group can't be
  renumbered to reach or pass a group above it (no leapfrogging), and the top
  group can't be deleted. Restoring a version snapshot re-grants permissions, so
  restore requires Manage Site.
- **Boot refuses a weak `SESSION_SECRET`** in production (placeholder or < 32
  chars). Set a strong one (§2).
- **Dev login is fail-closed** — OFF unless `DEV_LOGIN_ENABLED` is explicitly
  truthy. Keep it off in production.
- **Bot sync is secret-authenticated** (Bearer `BOT_SYNC_SECRET` /
  `BOT_SYNC_SECRET_MAP`), never a user session, and CSRF-exempt because it isn't
  cookie-authed. Mutating browser routes require a same-origin `Origin`/`Referer`.
- **Audit log is append-only**; `helmet` + CSP set security headers; `trust
  proxy` is configurable (§2).

---

## 8. Quick post-deploy checklist

- [ ] MariaDB reachable; app booted without the SESSION_SECRET error.
- [ ] Tables `department_config`, `audit_log`, `config_versions`, `sessions`
      exist (auto-created).
- [ ] `NODE_ENV=production`, `SESSION_SECRET` strong, `TRUST_PROXY=1` on Railway.
- [ ] `VITE_USE_BACKEND=true` was set when the build ran.
- [ ] Discord redirect URI matches `DISCORD_CALLBACK_URL` exactly.
- [ ] `auth.roleMappings` seeded with Director Team + Management team → `management`.
- [ ] `DEV_LOGIN_ENABLED` is OFF.
- [ ] A Management/Director member can sign in with Discord and open the Builder.

---

## 9. Moving onto Steve's own MariaDB/Express stack

Everything department-specific lives in env vars, and **all** DB access is in
`server/db.js`. To run against your own MariaDB, just point `DATABASE_URL` (or
the `DB_*` fields) at your instance — the app migrates its own tables on boot;
that's the entire integration. If you're folding this into an existing Express
app, the route modules in `server/routes/` (plus `server/auth.js`) drop in as
routers; you only need to provide a session store and the same env vars.

Questions on any of this — the annotated source of truth for env vars is
`.env.example`, and the backend architecture notes are in `server/README.md`.
