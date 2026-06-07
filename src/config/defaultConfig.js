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

export const CONFIG_VERSION = 1;

export const defaultConfig = {
  version: CONFIG_VERSION,

  branding: {
    name: "Department Hub",
    shortName: "Dept Hub",
    organization: "Your Department",
    tagline: "Internal Operations Platform",
    logoUrl: "", // empty → a generated monogram/shield is shown
    loginHeadline: "Department Hub",
    loginSubtext:
      "Centralized access for personnel, resources, and internal operations.",
    footerText: "© 2026 Your Department. All rights reserved.",
    colors: {
      primary: "#3b82f6",
      hover: "#2563eb",
      bg: "#0f1629",
      surface1: "#131b2e",
      surface2: "#131d35",
      bodyBg: "#111827",
    },
    socials: [
      // { id, label, url, icon }  e.g. { id:"discord", label:"Discord", url:"https://discord.gg/...", icon:"MessageCircle" }
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
   * Permission groups, ordered low → high by `level`. Pages declare which
   * groups may view them. A user belongs to exactly one primary group (their
   * highest matching Discord role); `admin` always sees everything.
   */
  groups: [
    { id: "member", label: "Member", level: 1 },
    { id: "supervisor", label: "Supervisor", level: 2 },
    { id: "command", label: "Command", level: 3 },
    { id: "admin", label: "Administrator", level: 4 },
  ],

  navGroups: ["Main", "Resources", "Administration"],

  pages: [
    {
      id: "home",
      label: "Home",
      navGroup: "Main",
      icon: "Home",
      type: "home",
      access: ["member", "supervisor", "command", "admin"],
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
            title: "Quick Links",
            items: [
              { id: "ql-1", label: "Department Discord", url: "#" },
              { id: "ql-2", label: "Standard Operating Procedures", url: "#" },
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
      access: ["member", "supervisor", "command", "admin"],
    },
    {
      id: "resources",
      label: "Resources",
      navGroup: "Resources",
      icon: "BookOpen",
      type: "content",
      access: ["member", "supervisor", "command", "admin"],
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
      id: "builder",
      label: "Builder Portal",
      navGroup: "Administration",
      icon: "Settings",
      type: "builder",
      access: ["admin"],
      locked: true, // cannot be deleted from the Builder Portal
    },
  ],

  roster: {
    // Custom columns shown for every member, across all subdivisions.
    // Types: text | select | date
    memberFields: [
      { id: "callsign", label: "Callsign", type: "text" },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: ["Active", "LOA", "Inactive"],
      },
    ],
    // Each subdivision is its own roster (its own ranks + members), shown as a
    // tab at the top of the Roster page. Departments can add as many as they
    // like (e.g. Patrol, K9, Traffic, Command Staff).
    subdivisions: [
      {
        id: "sub-main",
        name: "Department",
        ranks: [
          {
            id: "rank-command",
            name: "Command",
            color: "#f59e0b",
            members: [
              {
                id: "member-1",
                name: "Jane Doe",
                discordId: "",
                avatarUrl: "",
                fields: { callsign: "C-1", status: "Active" },
              },
            ],
          },
          {
            id: "rank-supervisor",
            name: "Supervisors",
            color: "#3b82f6",
            members: [],
          },
          {
            id: "rank-member",
            name: "Members",
            color: "#22c55e",
            members: [
              {
                id: "member-2",
                name: "John Smith",
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
