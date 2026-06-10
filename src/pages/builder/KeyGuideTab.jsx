import { useState } from "react";
import { Search } from "lucide-react";
import { Panel, SectionHeader, Input } from "../../components/common/index.jsx";

/*
 * Key Guide — a plain-English glossary of every term used around the hub and
 * the Builder, for Department Heads with no web background. Searchable; each
 * entry says what the thing is and where to find it.
 */

const GLOSSARY = [
  {
    section: "The basics",
    terms: [
      { term: "Builder Portal", def: "This tool. It's where you customize everything your members see — the look, the pages, and the roster structure. Only groups with the “Manage site” capability can open it." },
      { term: "Page", def: "One screen of your hub, reachable from the top bar — like Home, Roster, or SOPs. You create and arrange pages under Pages & Menu." },
      { term: "Navigation group (nav group)", def: "A heading in the top bar that pages are organized under. A group with several pages can be shown as a dropdown menu. Empty groups stay hidden until they contain a page." },
      { term: "Inline vs. Dropdown", def: "Two ways a nav group can appear in the top bar: Inline shows each page as its own link; Dropdown collapses the group's pages into one menu that opens on click." },
      { term: "Block", def: "The building pieces of a page. A page is just a stack of blocks — text, callouts, link lists, images, videos, and so on — that you add and reorder in the page editor." },
      { term: "Icon", def: "The small symbol shown next to a page's name in the top bar. Picked in the page editor — there's a search box to find one quickly." },
    ],
  },
  {
    section: "Page editor",
    terms: [
      { term: "Hero", def: "The big heading area at the top of a page, made of three optional parts: the kicker, the title, and the subtitle." },
      { term: "Hero kicker", def: "The small colored label ABOVE the page title — like “Welcome” or “Resources”. Think of it as a category tag for the page. Optional." },
      { term: "Hero title", def: "The big bold headline of the page, e.g. “Welcome to the Department Hub”." },
      { term: "Hero subtitle", def: "The smaller sentence under the title that explains what the page is for." },
      { term: "Text block", def: "A simple section: a heading with paragraph text under it. Your everyday block." },
      { term: "Callout block", def: "A highlighted notice box with an info icon — use it for important announcements people shouldn't miss." },
      { term: "Link list block", def: "A titled set of clickable buttons, each pointing at a link — great for documents, Discord channels, or forms." },
      { term: "Image block", def: "A picture on the page, with an optional caption. Paste a link or upload a file from your computer." },
      { term: "Video block", def: "A video on the page. Paste a YouTube link (plays right on the page), a direct video link, or upload a small clip." },
      { term: "Embed block", def: "Shows another website inside your page — like a published Google Doc, Sheet, or Form. Paste the link and set a height." },
      { term: "Two columns block", def: "Two pieces of text side by side — useful for comparisons or pairing rules with examples." },
      { term: "Spotlight block", def: "Cards highlighting people: photo, name, role, and a short description. Good for “Officer of the Month” or command staff intros." },
      { term: "Live preview", def: "The right-hand pane of the page editor that shows the page exactly as members will see it, updating as you type." },
      { term: "Restricted page", def: "A page limited to certain permission groups under “Who can see this page”. Everyone else won't even see it in the top bar. Site managers always see every page." },
    ],
  },
  {
    section: "Branding",
    terms: [
      { term: "Department name", def: "Your full name, e.g. “Florida Highway Patrol”. Shown on the login screen and around the hub." },
      { term: "Short name", def: "A compact version of the name that fits in the top bar." },
      { term: "Brand accent", def: "A part of your name highlighted in the signature orange — e.g. the “RP” in “Sunshine State RP”. Leave blank for none." },
      { term: "Logo", def: "Your department's square emblem. Paste a link or upload an image; leave blank and the hub generates a monogram from your name." },
      { term: "Banner", def: "A wide background image behind a hero area — the Home page has one, and each roster subdivision can have its own." },
      { term: "Theme colors", def: "The six colors that paint the whole hub. The fastest route is a one-click preset; each color can then be fine-tuned." },
      { term: "Primary / accent color", def: "Your main brand color — used for buttons, highlights, links, and active items." },
      { term: "Page background / Shell background", def: "Page background is the darkest layer behind everything; the shell background sits on top of it as the main app surface." },
      { term: "Surface 1 / Surface 2", def: "The colors of panels and cards stacked on the background — Surface 2 is used for elements sitting on top of Surface 1, like inputs and list rows." },
      { term: "Font", def: "The typeface used across the whole hub, chosen at the bottom of the Branding tab." },
      { term: "Community links", def: "The “Connect With Us” buttons on the login screen — Discord, TikTok, and so on." },
      { term: "Preset", def: "A ready-made full color scheme applied with one click. You can still adjust individual colors afterwards." },
    ],
  },
  {
    section: "Roster",
    terms: [
      { term: "Roster", def: "The personnel list page — who's in the department, their rank, and their details. Members are added on the Roster page itself, not in the Builder." },
      { term: "Subdivision", def: "A separate roster within your department — e.g. Patrol, K9, Traffic. Each has its own accent color, banner, and ranks. Shown as tabs or side-by-side, your choice under Roster Setup." },
      { term: "Main roster", def: "The primary subdivision (usually the whole department). Editing it requires the “Edit main roster” capability; other subdivisions use “Edit subdivision rosters”." },
      { term: "Rank", def: "A title on the ladder — Chief, Captain, Sergeant… Each member is assigned one, and ranks can carry an insignia image." },
      { term: "Category", def: "The colored grouping bands on the roster that members sit inside — e.g. Command, Supervisors, Members. Managed on the Roster page." },
      { term: "Member column", def: "A custom field every member has on the roster — like Callsign or Status. Types: text, dropdown, date, checkbox, or certification. Set up under Roster Setup." },
      { term: "Status pill", def: "A dropdown column displayed as a colored badge — e.g. green “Active”, purple “LOA”. Turn it on per dropdown column and pick a color per option." },
      { term: "Certification (cert)", def: "A column type that shows a CERTIFIED / N/A badge — for things like FTO or SWAT quals." },
      { term: "Stats box", def: "The metrics strip above the roster — total members, actives, certified counts, or any manual number. Configured under Roster Setup." },
      { term: "Insignia", def: "The small image next to a rank (chevrons, bars, stars). Added when editing ranks on the Roster page." },
      { term: "LOA", def: "Leave of Absence — a common status for members temporarily away." },
      { term: "Time in grade", def: "A column type that automatically counts the days since a date column (usually Date of Promotion). Its “resets when” setting decides what restarts the count: a category move, a rank change, either, or never — no typing by hand." },
      { term: "Promotion tool", def: "On the Roster page, tick the checkboxes next to members, pick a new rank in the bar that appears, and apply. It sets the rank, stamps Date of Promotion to today, and hands out new callsigns automatically." },
      { term: "Callsign format", def: "An optional pattern on a rank — like “91##” — where # digits auto-number. When the promotion tool assigns that rank, each member gets the next free callsign (9100, 9101…). Set it in the Ranks editor." },
    ],
  },
  {
    section: "Calendar & vehicle roster",
    terms: [
      { term: "Vehicle roster (fleet)", def: "A page type listing which vehicles each rank or unit may use — columns of ranks/units with vehicle cards (name + spawn code), a colored legend (Slicktop, Ghosted, Unmarked…), and a notes box. Added under Pages & Menu; edited on the page itself." },
      { term: "Legend tag", def: "The colored labels on a vehicle roster (e.g. Ghosted = green). Each vehicle can carry one tag, which colors its card border." },
      { term: "Department calendar", def: "A page type showing a month grid of events. It always opens on the current month, and past months move into the Archive automatically. Added under Pages & Menu." },
      { term: "Calendar event", def: "An entry on the calendar — title, date, time, details. People with the “Manage calendar” capability (Command and up by default) add and edit them; anyone signed in can open one and tap “I'll attend”." },
      { term: "Attendance", def: "The list of members who marked themselves attending an event. The count shows on the event in the calendar and in the archive." },
      { term: "Archive", def: "Where events from past months live — the Archive button on the calendar lists them grouped by month, with attendance counts." },
    ],
  },
  {
    section: "Access & permissions",
    terms: [
      { term: "Permission group", def: "A tier people belong to — e.g. Department Heads, Management, Command Staff. Each group has capabilities and a member list, managed under Administration → Access & Roles." },
      { term: "Capability", def: "A permission switch on a group: Manage site (open this Builder), Manage access (run groups), Edit main roster, and Edit subdivision rosters." },
      { term: "Level / hierarchy", def: "Each group has a level number. You can only manage groups at or below your own level — no editing the tiers above you." },
      { term: "Manager (of a group)", def: "A member flagged as manager can add or remove that group's people, even without the Manage access capability." },
      { term: "Discord ID", def: "The long number identifying a Discord account. Used to match people on login. In Discord: Settings → Advanced → Developer Mode, then right-click a user → Copy User ID." },
      { term: "Role mapping", def: "An optional rule connecting a Discord server role to a permission group, so people land in the right group automatically when they sign in." },
      { term: "Audit log", def: "The Administration page recording who changed what and when — site settings and roster edits alike." },
    ],
  },
  {
    section: "Saving & safety",
    terms: [
      { term: "Autosave", def: "There is no Save button — every change is stored automatically. The badge at the top of the Builder shows “Saving…” then “All changes saved”." },
      { term: "Undo", def: "The button at the top of the Builder that reverts your most recent change. It remembers your last 10 changes; a burst of quick edits counts as one." },
      { term: "Backup", def: "A single file containing your entire setup, downloaded from Backup & Restore. Keep one before big changes — restoring it brings everything back exactly." },
      { term: "Restore", def: "Loading a backup file to replace the current setup, under Backup & Restore." },
      { term: "Template", def: "A ready-made starting setup (Police / Fire / EMS) on the Start Here tab — colors, ranks, subdivisions, and a starter SOPs page, ready to rename and adjust." },
    ],
  },
];

export default function KeyGuideTab() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = GLOSSARY.map((s) => ({
    ...s,
    terms: q
      ? s.terms.filter((t) => `${t.term} ${t.def}`.toLowerCase().includes(q))
      : s.terms,
  })).filter((s) => s.terms.length > 0);

  return (
    <div className="grid gap-6">
      <Panel className="p-5">
        <SectionHeader
          title="Key Guide"
          subtitle="Every term used around the hub, explained in plain language. Search or scroll."
        />
        <div className="relative max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            placeholder="Search a term… e.g. hero kicker"
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Panel>

      {sections.map((s) => (
        <Panel key={s.section} className="p-5">
          <SectionHeader title={s.section} />
          <dl className="grid gap-3">
            {s.terms.map((t) => (
              <div
                key={t.term}
                className="rounded-xl border border-white/10 bg-[var(--color-surface-2)] p-3"
              >
                <dt className="text-sm font-bold text-white">{t.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-400">{t.def}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}

      {sections.length === 0 && (
        <Panel className="p-8 text-center text-sm text-slate-500">
          Nothing matches “{query}”. Try a shorter word — or ask in the staff Discord and
          we'll add it to the guide.
        </Panel>
      )}
    </div>
  );
}
