# Admin logs → Records portal (migration prep)

**Goal.** Departments log admin actions (hires, resignations, transfers, etc.) in
the hub instead of a Discord channel. Each entry should land in the **existing
Records-portal database** and show up on the subject member's background, linked by
their Discord ID.

This document is the contract for wiring that up. The hub side (this repo) is
prepped; the persistence is Steve's to implement in **one function**.

---

## Where it stands today

- Admin-log pages store their entries **inside the site config**:
  `config.pages[].config.entries` (that page's `config.books` holds the logbooks /
  entry types / custom fields). Entries are saved via `PUT /api/config`.
- Nothing is sent to the Records portal yet.

The migration adds a dedicated ingestion endpoint so entries also flow to Steve's
DB, without disturbing the working page (it keeps rendering from the config).

---

## The one function to implement

`server/records.js` → `forwardLog(departmentId, entry)`

It's already called by the endpoint below with a fully-validated, server-stamped
`entry`. Implement it against the Records DB. Keep it **non-throwing** — a records
outage must not break logging in the hub (the route catches and still responds ok).

```js
export async function forwardLog(departmentId, entry) {
  await recordsDb.query(
    `INSERT INTO member_background
       (discord_id, department, category, book, logged_by, logged_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ entry.subject.discordId, departmentId, entry.type, entry.bookName,
      entry.by.discordId, entry.at, JSON.stringify(entry) ]
  );
  return { forwarded: true };
}
```

The link to a member's background is **`entry.subject.discordId`**.

---

## Endpoint

`POST /api/logs` (mounted in `server/index.js`, code in `server/routes/logs.js`).

- Requires a signed-in session (`requireAuth`) and is behind the same-origin CSRF
  guard like the rest of `/api`.
- **The client sends only the entry content.** The server stamps the trustworthy
  bits so they can't be forged:
  - `by` — who logged it, from the session (`name`, `discordId`, `group`).
  - `department` — from the request host (multi-tenant).
  - `at` — server timestamp (ISO 8601).
- Validates size (≤256 KB) and that `subject.discordId`, if present, is a numeric
  snowflake.
- There is **no `GET /api/logs`** — reads come from the Records portal, not this
  service.

### Request body (from the hub)

```json
{
  "id": "entry-ab12cd34",
  "bookId": "book-…",
  "bookName": "Admin Log",
  "type": "Hired, Application",
  "date": "2026-07-02",
  "subject": { "name": "R. Ortiz", "discordId": "205177225488760834" },
  "values": [
    { "label": "Notes", "type": "textarea", "value": "Application #214 approved." }
  ]
}
```

### Entry passed to `forwardLog` (after server stamping)

```json
{
  "id": "entry-ab12cd34",
  "department": "fhp",
  "bookId": "book-…",
  "bookName": "Admin Log",
  "type": "Hired, Application",
  "date": "2026-07-02",
  "subject": { "name": "R. Ortiz", "discordId": "205177225488760834" },
  "values": [ { "label": "Notes", "type": "textarea", "value": "Application #214 approved." } ],
  "by":   { "name": "Capt. J. Welch", "discordId": "961651847736770770", "group": "command" },
  "at": "2026-07-02T18:22:05.114Z"
}
```

`values` is a snapshot of the book's custom fields at submission time (label +
type + value, plus `options` for dropdowns), so later edits to a book never change
what an old entry recorded.

---

## Flipping the hub over (when Steve's endpoint is live)

The client seam already exists: `submitLog(entry)` in `src/lib/api.js` (POSTs to
`/api/logs` when the backend is on, no-op in the mock).

To start sending entries, call it fire-and-forget in `saveEntry` in
`src/pages/AdminLog.jsx`, right where the Discord webhook is fired:

```js
import { submitLog } from "../lib/api.js";
// … after building `entry` for a NEW entry:
submitLog({
  id: entry.id, bookId: entry.bookId, bookName: entry.bookName,
  type: entry.type, date: entry.date, subject: entry.subject, values: entry.values,
}).catch(() => {}); // never block the UI
```

Entries keep saving to the config as they do now, so the page/statistics are
unaffected; this just also ships them to the Records DB. If/when you want the DB to
be the source of truth for reads, that's a follow-up (swap the page's data source).

---

## Notes

- **Trust boundary:** never accept `by`/`department`/`at` from the client — the
  server sets them. (The route already does.)
- **Idempotency:** the client sends a stable `entry.id`; if double-submits are a
  concern, upsert on `(department, id)`.
- **Retired types:** the default Admin Log no longer offers Strike / DA / Other —
  strikes/DAs come from the Records portal itself, so they should not be
  round-tripped back as hub log entries.
