# Department Hub

A modular, fully configurable **department hub** boilerplate. It's a blank
template each department (e.g. Florida Highway Patrol, Tampa PD, HCSO, HCFR)
can make their own — branding, pages, roster, and permissions are all
configured from an in-app **Builder Portal**, no code changes required.

Built with the same stack as the SSRP Staff Hub: **Vite + React + Tailwind**,
styled with theme CSS variables, designed around **Discord auth** + **MariaDB**.

> **Front-end only.** Every data call goes through a single module
> (`src/lib/api.js`) that is currently backed by `localStorage`, so the whole
> app — Builder Portal, roster editing, dev login — works with no server. When
> the backend is built, flip one flag and implement the documented REST contract.

---

## Quick start

```bash
npm install
npm run dev
```

Open the app and use **Developer preview** on the login screen to enter as any
permission group (no Discord needed yet). Sign in as **Administrator** to see
the **Builder Portal** under *Administration*.

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

Add a new page type by creating a component and registering it in
`PAGE_COMPONENTS` in `src/App.jsx`.

---

## The Builder Portal

Admins configure the hub here (auto-saves):

- **Branding** — names, logo, login copy, live theme colors, login community
  links, and the orange brand accent
- **Pages & Nav** — add/reorder/delete pages, nav groups, icons, per-group
  access, and edit content blocks (text / callout / link list)
- **Roster Schema** — roster layout (tabbed or side-by-side grid), custom
  member columns (text / dropdown / date / checkbox / certification), colored
  status pills with per-option colors, a configurable department-stats box,
  and per-subdivision accent + banner
- **Access & Roles** — groups with capability toggles (manage site / manage
  access / edit main roster / edit subdivision rosters), member + manager roles
  (managers add/remove their group's people), a level hierarchy (you can only
  manage groups at or below your own), and member lists by name + Discord ID;
  optional Discord role auto-assignment
- **Advanced** — export/import config JSON, reset to blank template

The **Roster** page presents subdivisions (e.g. Patrol, K9, Traffic — each its
own roster with its own accent color, banner image/logos, and stats box) as
either **tabs** or a **side-by-side grid**, chosen in the Builder. Both layouts
support add/edit/delete/reorder of ranks (with insignia images), members,
custom columns, and drag-to-move members between ranks.

---

## Wiring up the backend (for Steve)

The front-end never calls `fetch` directly except inside **`src/lib/api.js`**.
That file is the entire contract. To switch from the localStorage mock to a
real backend:

1. Set `VITE_USE_BACKEND=true` (e.g. in `.env`), or flip `USE_BACKEND` in
   `src/lib/api.js`.
2. Point `vite.config.js`'s proxy at the API server (already `/api` + `/auth`).
3. Implement these endpoints. All JSON responses use `{ ok: true, data }` or
   `{ ok: false, error }`.

### Config

| Method | Path                 | Body            | Returns        |
| ------ | -------------------- | --------------- | -------------- |
| `GET`  | `/api/config`        | —               | config object  |
| `PUT`  | `/api/config`        | full config     | saved config   |
| `POST` | `/api/config/reset`  | —               | default config |

Store the config as a JSON document (or normalized tables) in MariaDB, scoped
per department/guild.

### Auth (Discord via passport-discord)

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
  "avatar": "avatarHash",   // or avatarUrl
  "group": "command",       // highest matching mapped group
  "isAdmin": false
}
```

Content pages are viewable by any signed-in member. The Administration pages are
gated: Access & Roles needs manage-access (or being a group manager), the Audit
Log is staff-only, and the Builder Portal needs manage-site. Roster editing is
gated per-subdivision (main vs. subdivisions). See `src/lib/permissions.js` — the
backend must re-check capabilities on every protected request, never the client.

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
