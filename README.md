# Department Hub

A modular, fully configurable **department hub** boilerplate. It's a blank
template each department (e.g. Florida Highway Patrol, Tampa PD, HCSO, HCFR)
can make their own — branding, pages, roster, and permissions are all
configured from an in-app **Builder Portal**, no code changes required.

Built with the same stack as the SSRP Staff Hub: **Vite + React + Tailwind**,
styled with theme CSS variables, designed around **Discord auth** + **MariaDB**.

> **Backend-driven.** Every data call goes through a single module
> (`src/lib/api.js`) that talks to the Express + MariaDB backend in
> [`server/`](server/README.md) — config, roster, audit, versions, duty hours,
> and Discord auth all live server-side. The front-end needs that server running
> to load.

---

## Quick start

```bash
npm install
npm run server   # start the backend (see server/README.md for env + DB)
npm run dev      # in another terminal — Vite proxies /api + /auth to the server
```

Sign in with **Discord** on the login screen. A member whose Discord role maps to
a group with **Manage site** sees the **Builder Portal** under *Administration*.
For local testing without Discord, the backend exposes a gated `POST
/auth/dev-login` (set `DEV_LOGIN_ENABLED=true`; never enabled in production).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Vite dev server (proxies `/api`, `/auth`) |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Preview the production build         |

---

## How configuration works

The entire hub is driven by one config object (see
`src/config/defaultConfig.js`). It holds:

- **branding** — name, logo, login copy, theme colors, footer
- **groups** — permission tiers (member → admin), ordered by `level`
- **navGroups** — top-bar nav groups (each becomes a dropdown menu)
- **pages** — every page: label, icon, nav group, `access` groups, type, and
  (for content pages) hero text + content blocks
- **roster** — `memberFields` (shared custom columns) + `subdivisions` (each a
  tabbed roster with its own `ranks`, each rank holding members)
- **auth** — Discord guild id + role→group mappings, dev-login toggle

`ConfigProvider` (`src/lib/configContext.jsx`) loads it, applies the theme, and
exposes `mutate()` so any edit auto-saves (debounced) through `api.saveConfig`.

### Page types

| `type`    | Component         | Notes                                  |
| --------- | ----------------- | -------------------------------------- |
| `home`    | `Home.jsx`        | Hero + content blocks                  |
| `content` | `ContentPage.jsx` | Generic page of content blocks         |
| `roster`  | `Roster.jsx`      | Fully editable roster                  |
| `access`  | `AccessRoles.jsx` | Groups, capabilities, and members      |
| `audit`   | `AuditLog.jsx`    | Who changed what, and when             |
| `builder` | `BuilderPortal`   | Site configuration portal (locked)     |
| `fleet`   | `VehicleRoster.jsx` | Vehicle fleet structure per rank/unit |
| `uniforms`| `UniformRoster.jsx` | Uniform class structure cards         |
| `chain`   | `ChainOfCommand.jsx`| Org-chart builder (drag, zoom, logos) |
| `calendar`| `CalendarPage.jsx`  | Month calendar with events + attendance |
| `adminlog`| `AdminLog.jsx`      | Logbooks (hires/DAs/FTO/booth) + live stats |
| `activity`| `ActivityFeed.jsx`  | Member-facing changelog (roster/calendar/pages) |
| `hours`   | `DutyHours.jsx`     | Duty-hours leaderboard + table (from the Duty Hub) |

Add a new page type by creating a component and registering it in
`PAGE_COMPONENTS` in `src/App.jsx`.

---

## The Builder Portal

Admins configure the hub here (auto-saves, with a 10-step **Undo** history):

- **Start Here** — plain-English guide, auto-detected setup checklist, and
  one-click starter templates (Police / Fire / EMS)
- **Branding** — names, logo, login copy, live theme colors,
  login community links, and the orange brand accent. Images accept a URL
  *or* a direct upload (downscaled and stored inline until the backend lands)
- **Pages & Menu** — add/reorder/delete pages, nav groups, icons, optional
  per-group page visibility, a live side-by-side preview, and content blocks
  (text / callout / link list / image / video / embed / two-column /
  personnel spotlight)
- **Roster Setup** — roster layout (tabbed or side-by-side grid), custom
  member columns (text / dropdown / date / checkbox / certification), colored
  status pills with per-option colors, a configurable department-stats box,
  and per-subdivision accent + banner
- **Access & Roles** — groups with capability toggles (manage site / manage
  access / edit main roster / edit subdivision rosters), member + manager roles
  (managers add/remove their group's people), a level hierarchy (you can only
  manage groups at or below your own), and member lists by name + Discord ID;
  optional Discord role auto-assignment
- **Backup & Restore** — download/restore the config as a file (or paste JSON)

The **Roster** page presents subdivisions (e.g. Patrol, K9, Traffic — each its
own roster with its own accent color, banner image/logos, and stats box) as
either **tabs** or a **side-by-side grid**, chosen in the Builder. Both layouts
support add/edit/delete/reorder of ranks (with insignia images), members,
custom columns, and drag-to-move members between ranks.

---

## The backend

A reference Express + MariaDB server lives in **[`server/`](server/README.md)**
and implements the entire contract below. It runs as a single service (serves
the built `dist/` *and* the API), uses Discord OAuth2 (passport) for auth, and reuses the
front-end's own pure modules (`permissions.js`, `roster.js`, `defaultConfig.js`)
so client and server rules can't drift. See [`server/README.md`](server/README.md)
for local setup and a step-by-step **Railway** deploy (app + MySQL).

The front-end never calls `fetch` directly except inside **`src/lib/api.js`** —
that file is the entire contract:

1. Every call in `src/lib/api.js` hits the backend at `/api` (or `/auth`).
2. `vite.config.js`'s dev proxy forwards `/api` + `/auth` to the server on :3003.
3. The endpoints below are implemented in `server/`. All JSON responses use
   `{ ok: true, data }` or `{ ok: false, error }`.

### Config

| Method | Path                 | Body            | Returns        |
| ------ | -------------------- | --------------- | -------------- |
| `GET`  | `/api/config`        | —               | config object  |
| `PUT`  | `/api/config`        | full config     | saved config   |
| `GET`  | `/api/versions`      | —               | recent snapshots |
| `POST` | `/api/versions`      | `{ config, category, action }` | stored snapshot |

Store the config as a JSON document (or normalized tables) in MariaDB, scoped
per department/guild. The audit log (`GET`/`POST /api/audit`) is append-only
and kept **forever** — no pruning and no delete endpoint (the localStorage
mock's 500-entry cap exists only for browser quota).

**Version history** (`/api/versions`) keeps full config snapshots so any past
version can be restored (Google-Sheets style). Restoring is just a `PUT
/api/config` of the chosen snapshot, so it re-runs the same authorization — a
stored snapshot can never escalate privileges on restore. The mock keeps the
most recent few (snapshots are large); the backend keeps them in
`config_versions` (prune to taste).

### Duty hours (external Duty Hub → leaderboard)

The duty-hours page reads `GET /api/hours`:

```jsonc
{ "updatedAt": "…", "source": "duty-hub",
  "members": [{ "discordId": "…", "name": "…", "weekHours": 12, "monthHours": 48 }] }
```

The real hours live in the external **Duty Hub**. Feed them in either by having a
bot/cron `POST /api/hours { members: [...] }` (shared-secret auth, cached in the
`duty_hours` table), or by replacing the `GET` body with a live fetch+cache from
the Duty Hub API. The front-end joins these to roster members by `discordId` for
rank + callsign and counts strikes from the admin logs, so the endpoint only
needs the raw hours.

### Auth (Discord OAuth2 via passport-oauth2)

| Method | Path                     | Purpose                                   |
| ------ | ------------------------ | ----------------------------------------- |
| `GET`  | `/auth/discord`          | Begin Discord OAuth2                      |
| `GET`  | `/auth/discord/callback` | OAuth2 callback → set session cookie      |
| `GET`  | `/auth/me`               | Current user or `401`/null                |
| `POST` | `/auth/logout`           | Destroy session                           |

On login, resolve the member's group: first check whether their Discord id is
listed in any group's `members` (`config.groups[].members[].discordId` — the
primary, Google-Groups-style assignment managed in Builder → Access & Roles),
then optionally fall back to mapping their Discord roles via
`config.auth.roleMappings`. Pick the highest matching group and return a user
shaped like:

```jsonc
{
  "id": "discordUserId",
  "username": "Name",
  "displayName": "Guild Nick",  // the member's nickname in the SSRP guild
                                 // (member.nick → global display name → username)
  "avatar": "avatarHash",   // or avatarUrl
  "group": "command",       // highest matching mapped group
  "isAdmin": false
}
```

The front-end shows `displayName` wherever a human name appears (e.g. calendar
attendance), falling back to `username`.

Content pages are viewable by any signed-in member. The Administration pages are
gated: Access & Roles needs manage-access (or being a group manager), the Audit
Log is staff-only, and the Builder Portal needs manage-site. Roster editing is
gated per-subdivision (main vs. subdivisions). See `src/lib/permissions.js` — the
backend must re-check capabilities on every protected request, never the client.

### Discord rank sync (bot → roster)

Ranks can carry a `discordRoleId` (set in the Roster page's Ranks editor).
When the Discord bot sees a member's roles change (`guildMemberUpdate`), it
should call the backend, which loads the department's config and applies:

```js
import { syncMemberRanksFromDiscord } from ".../src/lib/roster.js";
const next = syncMemberRanksFromDiscord(config, discordUserId, currentRoleIds);
// if next !== config → save it + append an audit entry
```

Suggested endpoint (bot-authenticated, not session-authenticated):

| Method | Path                | Body                          | Effect                          |
| ------ | ------------------- | ----------------------------- | ------------------------------- |
| `POST` | `/api/roster/sync`  | `{ discordId, roleIds: [] }`  | Update that member's rank(s)    |

The helper is pure and already encodes the rules: ranks are ordered
highest-first, the first rank whose Discord role the member holds wins, and a
rank change runs through the same promotion pipeline as the UI (promotion-date
stamping per the Time in Grade setting, callsign auto-assignment from the
rank's callsign format). Members are matched by `member.discordId`.

### Disciplinary auto-probation (external Records portal → roster)

Departments configure rules in Builder → Roster Setup that map a disciplinary
log type to a probation length (e.g. *Strike → 14 days*, stored at
`config.discipline.autoProbation`). When a disciplinary entry is filed **inside
the hub's own admin-log page**, probation is applied automatically. If strikes
instead come from an **external SSRP Records portal**, have it (or the bot) call
the backend, which reuses the same pure helpers:

```js
import { probationDaysForType, applyAutoProbation } from ".../src/lib/roster.js";
const days = probationDaysForType(config, entryType);     // 0 if no rule matches
if (days) {
  const next = applyAutoProbation(config, discordId, days); // sets probation col
  // if next !== config → save it + append an audit entry
}
```

Suggested endpoint (authenticated like the rank sync, not a user session):

| Method | Path                  | Body                              | Effect                         |
| ------ | --------------------- | --------------------------------- | ------------------------------ |
| `POST` | `/api/records/strike` | `{ discordId, type }`             | Apply the matching probation   |

Probation is a plain date column, the hub renders a passed date as inactive, so
it "comes off" the member's profile automatically with no cleanup job.

### Security checklist (backend)

- **Re-check every capability server-side** (`src/lib/permissions.js` is the
  reference); the client checks are UX only.
- **Disable dev login in production**, ignore `config.auth.devLoginEnabled`
  server-side and never issue sessions without Discord OAuth.
- **CSRF**: the API is cookie-authenticated, so set the session cookie
  `SameSite=Lax` (or `Strict`) + `HttpOnly` + `Secure`, and require a CSRF
  token (or custom header) on mutating routes (`PUT /api/config`, `POST
  /api/audit`, `POST /api/roster/sync`).
- **`POST /api/roster/sync` is bot-only**, authenticate it with a shared
  secret/bot token, never a user session.
- **Validate imported configs** (`PUT /api/config`): enforce size limits and
  reject non-object shapes; the front-end sanitizes URLs at render time
  (`src/lib/urls.js`) but the server should never trust the payload.
- **Rate-limit** auth and config endpoints.
- **Admin-log webhook**: a management-set Discord webhook (per admin-log page,
  `page.config.webhook = { enabled, url, roleIds, … }`) posts each new log as an
  embed. Today the client sends it, so the URL lives in the config every member
  receives. For production, **redact `webhook.url` from config sent to
  non-managers** and fire the webhook **server-side** on the log write (reuse
  `buildWebhookPayload` from `src/pages/AdminLog.jsx`), so the URL never reaches
  regular clients.

### Environment

See `.env.example` for the Discord OAuth, MariaDB, and session variables the
server will need.

---

## Project layout

```
src/
  config/defaultConfig.js   # the blank template config (schema)
  lib/
    api.js                  # ← data layer / backend contract (swap point)
    configContext.jsx       # loads config, themes, autosaves
    theme.js                # branding colors → CSS variables
    navigation.js           # derive top-bar nav from config
    permissions.js          # group-based access checks
    roster.js               # pure roster edit operations
    icons.js                # icon registry (string → Lucide)
    storage.js              # localStorage helpers (mock backend)
    user.js                 # display helpers
  hooks/                    # useAuth, useToast
  components/
    common/                 # Panel, Button, Modal, Field, … + Logo
    auth/AuthScreens.jsx    # login + loading
    content/BlockRenderer   # renders page content blocks
  layouts/DashboardLayout   # top-bar nav + shell, driven by config
  pages/
    Home, Roster, ContentPage, BuilderPortal
    builder/                # Builder Portal tabs
```
