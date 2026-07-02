/*
 * Shared help content: the plain-English glossary (also shown in the Builder's
 * Key Guide tab) and step-by-step "how do I…" flows the Help Assistant walks
 * people through. Pure data, no imports, so both the page and the assistant can
 * use it without pulling in UI code.
 */

export const GLOSSARY = [
  {
    section: "The basics",
    terms: [
      { term: "Builder Portal", def: "This tool. It's where you customize everything your members see, the look, the pages, and the roster structure. Only groups with the “Manage site” capability can open it." },
      { term: "Page", def: "One screen of your hub, reachable from the top bar, like Home, Roster, or SOPs. You create and arrange pages under Pages & Menu." },
      { term: "Navigation group (nav group)", def: "A heading in the top bar that pages are organized under. A group with several pages can be shown as a dropdown menu. Empty groups stay hidden until they contain a page." },
      { term: "Inline vs. Dropdown", def: "Two ways a nav group can appear in the top bar: Inline shows each page as its own link; Dropdown collapses the group's pages into one menu that opens on click." },
      { term: "Block", def: "The building pieces of a page. A page is just a stack of blocks, text, callouts, link lists, images, videos, and so on, that you add and reorder in the page editor." },
      { term: "Icon", def: "The small symbol shown next to a page's name in the top bar. Picked in the page editor, there's a search box to find one quickly." },
    ],
  },
  {
    section: "Page editor",
    terms: [
      { term: "Hero", def: "The big heading area at the top of a page, made of three optional parts: the kicker, the title, and the subtitle." },
      { term: "Hero kicker", def: "The small colored label ABOVE the page title, like “Welcome” or “Resources”. Think of it as a category tag for the page. Optional." },
      { term: "Hero title", def: "The big bold headline of the page, e.g. “Welcome to the Department Hub”." },
      { term: "Hero subtitle", def: "The smaller sentence under the title that explains what the page is for." },
      { term: "Text block", def: "A simple section: a heading with paragraph text under it. Your everyday block." },
      { term: "Callout block", def: "A highlighted notice box with an info icon, use it for important announcements people shouldn't miss." },
      { term: "Link list block", def: "A titled set of clickable buttons, each pointing at a link, great for documents, Discord channels, or forms." },
      { term: "Image block", def: "A picture on the page, with an optional caption. Paste a link or upload a file from your computer." },
      { term: "Video block", def: "A video on the page. Paste a YouTube link (plays right on the page), a direct video link, or upload a small clip." },
      { term: "Embed block", def: "Shows another website inside your page, like a published Google Doc, Sheet, or Form. Paste the link and set a height." },
      { term: "Two columns block", def: "Two pieces of text side by side, useful for comparisons or pairing rules with examples." },
      { term: "Spotlight block", def: "Cards highlighting people: photo, name, role, and a short description. Good for “Officer of the Month” or command staff intros." },
      { term: "Block width", def: "Each block has a width setting (full, ⅔, ½, ⅓). Narrower blocks share a row on desktop, so you can place boxes side by side like a dashboard; phones always stack them." },
      { term: "Live preview", def: "The right-hand pane of the page editor that shows the page exactly as members will see it, updating as you type." },
      { term: "Restricted page", def: "A page limited to certain permission groups under “Who can see this page”. Everyone else won't even see it in the top bar. Site managers always see every page." },
    ],
  },
  {
    section: "Branding",
    terms: [
      { term: "Department name", def: "Your full name, e.g. “Florida Highway Patrol”. Shown on the login screen and around the hub." },
      { term: "Short name", def: "A compact version of the name that fits in the top bar." },
      { term: "Brand accent", def: "A part of your name highlighted in the signature orange, e.g. the “RP” in “Sunshine State RP”. Leave blank for none." },
      { term: "Logo", def: "Your department's square emblem. Paste a link or upload an image; leave blank and the hub generates a monogram from your name." },
      { term: "Banner", def: "A wide background image behind a hero area, the Home page has one, and each roster subdivision can have its own." },
      { term: "Theme colors", def: "The six colors that paint the whole hub. The fastest route is a one-click preset; each color can then be fine-tuned." },
      { term: "Primary / accent color", def: "Your main brand color, used for buttons, highlights, links, and active items." },
      { term: "Page background / Shell background", def: "Page background is the darkest layer behind everything; the shell background sits on top of it as the main app surface." },
      { term: "Surface 1 / Surface 2", def: "The colors of panels and cards stacked on the background, Surface 2 is used for elements sitting on top of Surface 1, like inputs and list rows." },
      { term: "Community links", def: "The “Connect With Us” buttons on the login screen, Discord, TikTok, and so on." },
      { term: "Preset", def: "A ready-made full color scheme applied with one click. You can still adjust individual colors afterwards." },
    ],
  },
  {
    section: "Roster",
    terms: [
      { term: "Roster", def: "The personnel list page, who's in the department, their rank, and their details. Members are added on the Roster page itself, not in the Builder." },
      { term: "Subdivision", def: "A separate roster within your department, e.g. Patrol, K9, Traffic. Each has its own accent color, banner, and ranks. Shown as tabs or side-by-side, your choice under Roster Setup." },
      { term: "Main roster", def: "The primary subdivision (usually the whole department). Editing it requires the “Edit main roster” capability; other subdivisions use “Edit subdivision rosters”." },
      { term: "Rank", def: "A title on the ladder, Chief, Captain, Sergeant… Each member is assigned one, and ranks can carry an insignia image." },
      { term: "Category", def: "The colored grouping bands on the roster that members sit inside, e.g. Command, Supervisors, Members. Managed on the Roster page." },
      { term: "Member column", def: "A custom field every member has on the roster, like Callsign or Status. Types: text, dropdown, date, checkbox, or certification. Set up under Roster Setup." },
      { term: "Status pill", def: "A dropdown column displayed as a colored badge, e.g. green “Active”, purple “LOA”. Turn it on per dropdown column and pick a color per option." },
      { term: "Certification (cert)", def: "A column type that shows a CERTIFIED / N/A badge, for things like FTO or SWAT quals." },
      { term: "Stats box", def: "The metrics strip above the roster, total members, actives, certified counts, or any manual number. Configured under Roster Setup." },
      { term: "Insignia", def: "The small image next to a rank (chevrons, bars, stars). Added when editing ranks on the Roster page." },
      { term: "LOA", def: "Leave of Absence, a common status for members temporarily away." },
      { term: "Time in grade", def: "A column type that automatically counts the days since a date column (usually Date of Promotion). Its “resets when” setting decides what restarts the count: a category move, a rank change, either, or never, no typing by hand." },
      { term: "Promotion tool", def: "On the Roster page, tick the checkboxes next to members, pick a new rank in the bar that appears, and apply. It sets the rank, stamps Date of Promotion to today, and hands out new callsigns automatically." },
      { term: "Days in service", def: "A column type that automatically counts the days since a date column, usually the member's hire date or date of entry. Unlike Time in Grade it never resets, the count simply grows by one each day." },
      { term: "Roster controller (Manage)", def: "The Manage button on the Roster page opens one tabbed window for everything structural: Ranks, Columns, Statistics, and Terminations, instead of separate buttons scattered around the page." },
      { term: "Terminate / Termination roster", def: "Terminating a member removes them from every subdivision at once and archives their full record (rank, fields, memberships) under Manage \u2192 Terminations. Overturn reinstates them exactly as they were." },
      { term: "Overturn", def: "Reinstates a terminated member from the Termination Roster, restoring their name, rank, fields, and subdivision memberships." },
      { term: "LOA automation", def: "Setting someone\u2019s status to LOA stores their return date and prior status, and writes a roster note automatically. Taking them off LOA cleans both up." },
      { term: "Bulk actions", def: "Tick member checkboxes and the bar at the bottom can promote/demote (with optional probation), set activity status, grant or revoke certifications, and set or clear probation for everyone selected at once." },
      { term: "FTO / Cadets tab", def: "In the Roster Controller (Manage): hire applicants straight into your cadet rank (auto hire date, callsign, Active status), see everyone in the program, and process final evals, pass promotes them with callsign and optional probation in one click, fail terminates them to the archive." },
      { term: "Administrative log", def: "A page type with logbooks for everything departments track: hires (open interview / application), resignations, transfers, verbal and non-verbal DAs, strikes, FTO sessions, interviews, and booth shifts. Books, entry types, and custom fields are all editable, and every entry is snapshotted at submission, so later changes never break old records." },
      { term: "Log statistics", def: "The Statistics tab on an administrative log page: department-wide counts per logbook and entry type, plus a search by name or Discord ID showing entries about a member and entries logged by them. It recalculates instantly as entries are added, edited, or deleted." },
      { term: "Hire automation", def: "Adding a member auto-fills their hire/entry date with today and assigns the next free callsign for their rank\u2019s format. Date of Promotion defaults to today too." },
      { term: "Callsign format", def: "An optional pattern on a rank, like “91##”, where # digits auto-number. When the promotion tool assigns that rank, each member gets the next free callsign (9100, 9101…). Set it in the Ranks editor." },
    ],
  },
  {
    section: "Calendar, vehicle & uniform rosters",
    terms: [
      { term: "Vehicle roster (fleet)", def: "A page type listing which vehicles each rank or unit may use, columns of ranks/units with vehicle cards (name + spawn code), a colored legend (Slicktop, Ghosted, Unmarked…), and a notes box. Added under Pages & Menu; edited on the page itself." },
      { term: "Legend tag", def: "The colored labels on a vehicle roster (e.g. Ghosted = green). Each vehicle can carry one tag, which colors its card border." },
      { term: "Uniform roster", def: "A page type replacing the uniform class structure sheets: a card per uniform (Class A, Class B, vest options, pins…) with a reference photo, a table of component numbers and textures, and rules notes. Added under Pages & Menu; edited on the page itself." },
      { term: "Component (uniform)", def: "One clothing slot on a uniform card, its category (Upperbody, Hats & Helmets…), the item number, and the texture to use." },
      { term: "Chain of command", def: "A page type replacing the org-chart sheets: boxes for each position (title + holder) connected top-down with arrows, with optional member lists under the bottom boxes. Click a box to edit it or add the positions below it." },
      { term: "Department calendar", def: "A page type showing a month grid of events. It always opens on the current month, and past months move into the Archive automatically. Added under Pages & Menu." },
      { term: "Calendar event", def: "An entry on the calendar, title, date, time, details. People with the “Manage calendar” capability (Command and up by default) add and edit them; anyone signed in can open one and tap “I'll attend”." },
      { term: "Attendance", def: "The list of members who marked themselves attending an event. The count shows on the event in the calendar and in the archive." },
      { term: "Archive", def: "Where events from past months live, the Archive button on the calendar lists them grouped by month, with attendance counts." },
    ],
  },
  {
    section: "Access & permissions",
    terms: [
      { term: "Permission group", def: "A tier people belong to, e.g. Department Heads, Management, Command Staff. Each group has capabilities and a member list, managed under Administration → Access & Roles." },
      { term: "Capability", def: "A permission switch on a group: Manage site (open this Builder), Manage access (run groups), Edit main roster, and Edit subdivision rosters." },
      { term: "Level / hierarchy", def: "Each group has a level number. You can only manage groups at or below your own level, no editing the tiers above you." },
      { term: "Manager (of a group)", def: "A member flagged as manager can add or remove that group's people, even without the Manage access capability." },
      { term: "Discord ID", def: "The long number identifying a Discord account. Used to match people on login. In Discord: Settings → Advanced → Developer Mode, then right-click a user → Copy User ID." },
      { term: "Role mapping", def: "An optional rule connecting a Discord server role to a permission group, so people land in the right group automatically when they sign in." },
      { term: "Audit log", def: "The Administration page recording who changed what and when, site settings and roster edits alike." },
    ],
  },
  {
    section: "Saving & safety",
    terms: [
      { term: "Autosave", def: "There is no Save button, every change is stored automatically. The badge at the top of the Builder shows “Saving…” then “All changes saved”." },
      { term: "Undo", def: "The button at the top of the Builder that reverts your most recent change. It remembers your last 10 changes; a burst of quick edits counts as one." },
      { term: "Backup", def: "A single file containing your entire setup, downloaded from Backup & Restore. Keep one before big changes, restoring it brings everything back exactly." },
      { term: "Restore", def: "Loading a backup file to replace the current setup, under Backup & Restore." },
      { term: "Template", def: "A ready-made starting setup (Police / Fire / EMS) on the Start Here tab, colors, ranks, subdivisions, and a starter SOPs page, ready to rename and adjust." },
    ],
  },
];

/*
 * How-to flows the assistant matches a question against. `keywords` are matched
 * loosely (substring) against the question; the best-scoring flow's `steps` are
 * returned. Keep steps short and action-first — they're read in a chat bubble.
 */
export const HOW_TO = [
  {
    id: "add-page",
    title: "Add or edit a page",
    keywords: ["page", "add page", "new page", "create page", "menu", "tab", "navigation", "nav"],
    steps: [
      "Open the Builder Portal (Administration → Builder Portal).",
      "Go to the “Pages & Menu” tab.",
      "Click “Add page”, then set its name, nav group, and icon.",
      "Pick the page type (content, roster, calendar, chain of command, and so on).",
      "Open the page to add blocks or content — everything autosaves as you go.",
    ],
  },
  {
    id: "branding",
    title: "Change colors, logo, or department name",
    keywords: ["color", "colour", "theme", "brand", "branding", "logo", "banner", "name", "preset", "background", "accent"],
    steps: [
      "Builder Portal → “Branding” tab.",
      "Set your department name, short name, and brand accent.",
      "Add a logo and banner (paste a link or upload; blank makes a monogram).",
      "Under Theme colors, click a preset for a one-click scheme, then fine-tune any of the six colors.",
    ],
  },
  {
    id: "add-rank",
    title: "Add or edit a rank",
    keywords: ["rank", "ranks", "insignia", "callsign format", "promotion ladder", "seniority"],
    steps: [
      "Go to the Roster page (ranks live on the roster, not in the Builder).",
      "Click “Manage” → “Ranks”.",
      "Add a rank and set its name, optional insignia image, and an optional callsign format like 91##.",
      "Drag ranks to reorder them by seniority.",
    ],
  },
  {
    id: "add-column",
    title: "Add a roster column (custom field)",
    keywords: ["column", "field", "custom field", "callsign", "status", "cert", "certification", "checkbox", "dropdown", "time in grade", "days in service"],
    steps: [
      "Roster page → “Manage” → “Columns”.",
      "Add a column and choose a type: text, dropdown, date, checkbox, certification, time in grade, or days in service.",
      "For a dropdown, add its options; turn on “status pill” to show colored badges.",
    ],
  },
  {
    id: "add-member",
    title: "Add or edit a member",
    keywords: ["member", "add member", "hire", "add person", "people", "roster edit", "add someone"],
    steps: [
      "Open the Roster page.",
      "Click “Add member” in the right category, then fill in name, rank, Discord ID, and columns.",
      "Tick member checkboxes to use the bottom bar for bulk actions (promote, set status, certs, probation).",
    ],
  },
  {
    id: "groups",
    title: "Create a group or give someone access",
    keywords: ["group", "permission", "access", "role", "capability", "admin", "manage site", "make admin", "give access"],
    steps: [
      "Administration → “Access & Roles”.",
      "Click “Add group”, name it, and set its level and capabilities (Manage site, Edit roster, and so on).",
      "Add people by name + Discord ID, or link a Discord role so they're assigned automatically on login.",
    ],
  },
  {
    id: "discord-roles",
    title: "Link a Discord role to a group",
    keywords: ["discord role", "role id", "auto assign", "link role", "login role", "role mapping"],
    steps: [
      "Administration → Access & Roles.",
      "On the group's card, under “Discord roles”, paste the Discord role ID (and an optional label) and click Link.",
      "Anyone with that role in your guild joins the group automatically when they sign in with Discord.",
    ],
  },
  {
    id: "subdivisions",
    title: "Add a subdivision (separate roster)",
    keywords: ["subdivision", "subdivisions", "patrol", "k9", "division", "unit", "separate roster", "troop"],
    steps: [
      "Builder Portal → “Roster Setup”.",
      "Add a subdivision and give it a name, accent color, and optional banner.",
      "Switch to the Roster page to add its ranks and members.",
    ],
  },
  {
    id: "chain-of-command",
    title: "Build the chain of command",
    keywords: ["chain of command", "org chart", "coc", "hierarchy", "boxes", "position", "command chart"],
    steps: [
      "Add a “Chain of command” page under Pages & Menu, or open the existing one.",
      "Click “Import from roster” to auto-build the top tiers, or “Start blank”.",
      "Click a box to edit it; use “Fill from roster” to link it to a rank or division so it updates automatically.",
      "Drag a box onto another to move it under it, or onto a box's edge to slot it beside it.",
    ],
  },
  {
    id: "calendar",
    title: "Set up the calendar or add an event",
    keywords: ["calendar", "event", "schedule", "attendance", "meeting", "training day"],
    steps: [
      "Add a “Department calendar” page under Pages & Menu.",
      "On the calendar, click a day to add an event (title, time, details).",
      "Members can open an event and tap “I'll attend”. Past months move to the Archive automatically.",
    ],
  },
  {
    id: "vehicle-uniform",
    title: "Vehicle roster or uniform roster",
    keywords: ["vehicle", "fleet", "car", "uniform", "outfit", "class a", "loadout"],
    steps: [
      "Add a “Vehicle roster” or “Uniform roster” page under Pages & Menu.",
      "Edit it on the page itself: add vehicle cards (name + spawn code) or uniform cards (photo + component numbers).",
    ],
  },
  {
    id: "admin-log",
    title: "Administrative log (hires, strikes, FTO, webhook)",
    keywords: ["log", "admin log", "strike", "da", "disciplinary", "fto", "interview", "webhook", "logbook"],
    steps: [
      "Add an “Administrative log” page under Pages & Menu.",
      "Set up its logbooks and entry types; each entry is snapshotted when submitted.",
      "Management can open Webhook settings to post new log entries to a Discord channel.",
    ],
  },
  {
    id: "backup",
    title: "Back up or restore your setup",
    keywords: ["backup", "back up", "restore", "save file", "export", "import", "download setup"],
    steps: [
      "Builder Portal → “Backup & Restore”.",
      "Click “Download backup” to save a file of your whole setup before big changes.",
      "Use “Restore” to load a backup file and replace the current setup.",
    ],
  },
  {
    id: "templates",
    title: "Start from a template",
    keywords: ["template", "start", "police", "fire", "ems", "getting started", "setup", "start here"],
    steps: [
      "Builder Portal → “Start Here”.",
      "Pick a template (Police / Fire / EMS) to load colors, ranks, subdivisions, and a starter page.",
      "Rename and adjust from there — nothing is locked in.",
    ],
  },
  {
    id: "saving",
    title: "How saving and undo work",
    keywords: ["save", "autosave", "undo", "revert", "saved", "lost changes"],
    steps: [
      "There's no Save button — every change autosaves (watch the “Saving… / All changes saved” badge).",
      "Use “Undo” at the top of the Builder to revert your last change (it remembers your last 10).",
    ],
  },
];
