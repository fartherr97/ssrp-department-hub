/*
 * The default ("blank") department configuration.
 *
 * This single object drives the entire hub: branding/theme, navigation, pages,
 * the roster schema + data, and the permission model. A department customizes
 * everything from the Builder Portal, which simply edits a copy of this shape
 * and persists it (via src/lib/api.js → localStorage today, MariaDB later).
 *
 * Schema version lets the loader migrate older saved configs safely.
 */

export const CONFIG_VERSION = 2;

export const defaultConfig = {
  version: CONFIG_VERSION,

  branding: {
    name: "Sunshine State RP",
    shortName: "Sunshine State RP",
    // A token of the brand name highlighted in the CAD orange accent (e.g. "RP").
    brandAccent: "RP",
    organization: "Sunshine State Roleplay",
    tagline: "Internal Operations Platform",
    logoUrl: "", // empty → a generated monogram/shield is shown
    bannerUrl: "", // hero background banner on the Home page (empty → gradient only)
    loginHeadline: "Sunshine State Roleplay",
    loginSubtext:
      "Centralized access for personnel, resources, and internal operations.",
    // The login footer is fixed SSRP network branding (see AuthScreens.jsx),
    // deliberately not part of the per-department config.
    colors: {
      // SSRP CAD palette, dark navy / slate with brand blue accent.
      primary: "#3d82f0",
      hover: "#5a97f5",
      bg: "#101d31",
      surface1: "#13233b",
      surface2: "#192f4d",
      bodyBg: "#0b1424",
    },
    // Community links shown on the login screen ("Connect With Us"). icon is a
    // name from src/lib/icons.js (ICON_NAMES). Edit these in the Builder Portal.
    socials: [
      { id: "discord", label: "Discord", url: "https://discord.gg/", icon: "MessageCircle" },
    ],
  },

  auth: {
    discordGuildId: "",
    // Maps a Discord role to a permission group. The backend resolves a member's
    // Discord roles → highest matching group on login.
    roleMappings: [
      // { roleId: "1234", roleName: "Command Staff", group: "command" },
    ],
    // Lets you preview the hub as any role without a backend (front-end demo).
    devLoginEnabled: true,
  },

  /*
   * Permission groups, ordered low → high by `level`. A user belongs to one
   * primary group (their highest matching Discord role / explicit member
   * assignment); capabilities gate what each group can edit.
   */
  groups: [
    // Each group carries capability flags + an explicit member list. A member's
    // role is "member" or "manager" (managers can add/remove that group's
    // people). You can only administer groups at or below your own level.
    { id: "dept-heads", label: "Department Heads", level: 4, manageSite: true, manageAccess: true, editRoster: true, editSubdivisions: true, manageCalendar: true, manageLogs: true, members: [] },
    { id: "management", label: "Management", level: 3, manageSite: true, manageAccess: true, editRoster: true, editSubdivisions: true, manageCalendar: true, manageLogs: true, members: [] },
    { id: "command", label: "Command Staff", level: 2, manageSite: false, manageAccess: false, editRoster: true, editSubdivisions: true, manageCalendar: true, manageLogs: true, members: [] },
    { id: "subdivisions", label: "Subdivisions", level: 1, manageSite: false, manageAccess: false, editRoster: false, editSubdivisions: true, manageCalendar: false, manageLogs: false, members: [] },
  ],

  navGroups: ["Main", "Resources", "Administration", "Builder"],

  // Nav groups whose pages collapse into a dropdown menu in the top bar instead
  // of showing each page inline. "Administration" groups the admin tools (Access
  // & Roles, Audit Log); the Builder Portal sits on its own inline.
  dropdownGroups: ["Administration"],

  pages: [
    {
      id: "home",
      label: "Home",
      navGroup: "Main",
      icon: "Home",
      type: "home",
      config: {
        heroKicker: "Welcome",
        heroTitle: "Welcome to the Department Hub",
        heroSubtitle:
          "This is a blank template. Open the Builder Portal to make it your own.",
        blocks: [
          {
            id: "block-getting-started",
            type: "callout",
            title: "Getting started",
            body: "Head to the Builder Portal (Administration → Builder Portal) to set your branding, build out pages, and configure your roster.",
          },
          {
            id: "block-quick-links",
            type: "links",
            layout: "cards",
            kicker: "Quick Access",
            title: "Quick Resources",
            allLabel: "All",
            allUrl: "",
            items: [
              { id: "ql-1", label: "Department Discord", url: "#", icon: "MessageCircle" },
              { id: "ql-2", label: "Standard Operating Procedures", url: "#", icon: "BookOpen" },
              { id: "ql-3", label: "Roster", url: "#", icon: "Users" },
              { id: "ql-4", label: "Training", url: "#", icon: "GraduationCap" },
            ],
          },
        ],
      },
    },
    {
      id: "roster",
      label: "Roster",
      navGroup: "Main",
      icon: "Users",
      type: "roster",
    },
    {
      id: "resources",
      label: "Resources",
      navGroup: "Resources",
      icon: "BookOpen",
      type: "content",
      config: {
        heroTitle: "Resources",
        heroSubtitle: "Documents, guides, and references for the department.",
        blocks: [
          {
            id: "block-resources-intro",
            type: "text",
            title: "About this page",
            body: "Replace this with your department's resources. Add link lists, documents, or notices from the Builder Portal.",
          },
        ],
      },
    },
    {
      id: "access",
      label: "Access & Roles",
      navGroup: "Administration",
      icon: "Shield",
      type: "access",
    },
    {
      id: "audit",
      label: "Audit Log",
      navGroup: "Administration",
      icon: "ClipboardList",
      type: "audit",
    },
    {
      id: "builder",
      label: "Builder Portal",
      navGroup: "Builder",
      icon: "Settings",
      type: "builder",
      locked: true, // cannot be deleted from the Builder Portal
    },
  ],

  roster: {
    // How the roster page presents subdivisions: "tabs" (one at a time) or
    // "grid" (all side-by-side). Department Heads choose this in the Builder.
    layout: "tabs",

    // Custom columns shown for every member, across all subdivisions.
    // Types: text | select | date | checkbox | cert | tenure | service
    //  - select  may set `pill: true` + `optionColors` to render colored status pills
    //  - checkbox renders a ✓ tick; cert renders a CERTIFIED / N/A pill
    memberFields: [
      { id: "callsign", label: "Callsign", type: "text" },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: ["Active", "LOA", "Inactive"],
        pill: true,
        optionColors: { Active: "#1eb854", LOA: "#a855f7", Inactive: "#94a3b8" },
      },
      { id: "fto", label: "FTO", type: "cert" },
      { id: "academy", label: "Academy", type: "checkbox" },
    ],

    // Optional department metrics box, computed over the active subdivision.
    // mode: total | status | cert | manual
    stats: {
      show: true,
      items: [
        { id: "st-total", label: "Members", mode: "total" },
        { id: "st-active", label: "Active", mode: "status", statusValue: "Active" },
        { id: "st-loa", label: "LOA", mode: "status", statusValue: "LOA" },
        { id: "st-fto", label: "FTO Certified", mode: "cert", fieldId: "fto" },
      ],
    },

    // Each subdivision is its own roster, shown as a tab (or grid card). It owns
    // a list of `ranks` (titles like Colonel/Captain, shown in the Rank column)
    // and `categories` (the colored grouping bands that hold members). Each can
    // carry its own accent color and a banner for a distinct department look.
    subdivisions: [
      {
        id: "sub-main",
        name: "Department",
        main: true, // the main department roster (editable by editRoster groups)
        accent: "#3d82f0",
        banner: {
          imageUrl: "",
          logoUrl: "",
          logoUrl2: "",
          title: "Department Roster",
          subtitle: "Personnel & Assignments",
        },
        ranks: [
          { id: "rank-chief", name: "Chief", insigniaUrl: "" },
          { id: "rank-captain", name: "Captain", insigniaUrl: "" },
          { id: "rank-lieutenant", name: "Lieutenant", insigniaUrl: "" },
          { id: "rank-sergeant", name: "Sergeant", insigniaUrl: "" },
          { id: "rank-officer", name: "Officer", insigniaUrl: "" },
        ],
        categories: [
          {
            id: "cat-command",
            name: "Command",
            color: "#f59e0b",
            insigniaUrl: "",
            members: [
              {
                id: "member-1",
                name: "Jane Doe",
                rank: "rank-chief",
                discordId: "",
                avatarUrl: "",
                fields: { callsign: "C-1", status: "Active", fto: true, academy: true },
              },
            ],
          },
          {
            id: "cat-supervisor",
            name: "Supervisors",
            color: "#3b82f6",
            insigniaUrl: "",
            members: [],
          },
          {
            id: "cat-member",
            name: "Members",
            color: "#22c55e",
            insigniaUrl: "",
            members: [
              {
                id: "member-2",
                name: "John Smith",
                rank: "rank-officer",
                discordId: "",
                avatarUrl: "",
                fields: { callsign: "M-14", status: "Active" },
              },
            ],
          },
        ],
      },
    ],
  },
};

// A small, deep-ish clone helper so callers never mutate the frozen default.
export function cloneDefaultConfig() {
  return structuredClone(defaultConfig);
}
