/*
 * Starter templates — full configs a Department Head can apply from the
 * Builder's Start Here tab to begin from something real instead of the blank
 * boilerplate. Each builds on the default config and swaps in a themed
 * palette, rank structure, subdivisions, and a starter SOPs page. Names are
 * deliberately generic ("Police Department") so the first step is still
 * renaming it in Branding.
 */

import { cloneDefaultConfig } from "./defaultConfig.js";

function subdivision({ id, name, main = false, accent, bannerTitle, bannerSubtitle, ranks }) {
  return {
    id,
    name,
    main,
    accent,
    banner: { imageUrl: "", logoUrl: "", logoUrl2: "", title: bannerTitle, subtitle: bannerSubtitle },
    ranks: ranks.map((r, i) => ({ id: `${id}-rank-${i}`, name: r, insigniaUrl: "" })),
    categories: [
      { id: `${id}-cat-command`, name: "Command", color: "#f59e0b", insigniaUrl: "", members: [] },
      { id: `${id}-cat-supervisors`, name: "Supervisors", color: "#3b82f6", insigniaUrl: "", members: [] },
      { id: `${id}-cat-members`, name: "Members", color: "#22c55e", insigniaUrl: "", members: [] },
    ],
  };
}

function sopPage(deptWord) {
  return {
    id: "page-sops",
    label: "SOPs",
    navGroup: "Resources",
    icon: "ClipboardList",
    type: "content",
    config: {
      heroKicker: "Resources",
      heroTitle: "Standard Operating Procedures",
      heroSubtitle: `How we operate as a ${deptWord}. Replace these with your real SOP links.`,
      blocks: [
        {
          id: "sop-callout",
          type: "callout",
          title: "Read before your first shift",
          body: "All members are expected to know these procedures. Questions go to your supervisor.",
        },
        {
          id: "sop-links",
          type: "links",
          title: "Documents",
          items: [
            { id: "sop-1", label: "General Conduct SOP", url: "#" },
            { id: "sop-2", label: "Radio Procedures", url: "#" },
            { id: "sop-3", label: "Chain of Command", url: "#" },
          ],
        },
      ],
    },
  };
}

function applyCommon(cfg, { name, organization, headline, colors, statusColors }) {
  cfg.branding = {
    ...cfg.branding,
    name,
    shortName: name,
    brandAccent: "",
    organization,
    loginHeadline: name,
    loginSubtext: headline,
    colors: { ...cfg.branding.colors, ...colors },
  };
  const home = cfg.pages.find((p) => p.id === "home");
  if (home) {
    home.config.heroTitle = `Welcome to ${name}`;
    home.config.heroSubtitle = headline;
  }
  // Insert the SOPs page after Resources.
  const i = cfg.pages.findIndex((p) => p.id === "resources");
  cfg.pages.splice(i === -1 ? cfg.pages.length : i + 1, 0, sopPage(organization.toLowerCase()));
  if (statusColors) {
    const status = cfg.roster.memberFields.find((f) => f.id === "status");
    if (status) status.optionColors = { ...status.optionColors, ...statusColors };
  }
  return cfg;
}

export const TEMPLATES = [
  {
    id: "police",
    label: "Police Department",
    desc: "Deep blue theme, patrol-style ranks, Patrol / K9 / Traffic subdivisions, and a starter SOPs page.",
    swatch: ["#2e69f1", "#0b1430"],
    build() {
      const cfg = cloneDefaultConfig();
      applyCommon(cfg, {
        name: "Police Department",
        organization: "Law Enforcement",
        headline: "Serving the city — personnel, procedures, and operations in one place.",
        colors: { primary: "#2e69f1", hover: "#5586f4", bg: "#0b1430", surface1: "#101c40", surface2: "#1a2c58", bodyBg: "#060a16" },
      });
      cfg.roster.subdivisions = [
        subdivision({
          id: "sub-patrol", name: "Patrol", main: true, accent: "#2e69f1",
          bannerTitle: "Patrol Division", bannerSubtitle: "Primary response & operations",
          ranks: ["Chief of Police", "Assistant Chief", "Captain", "Lieutenant", "Sergeant", "Corporal", "Officer", "Probationary Officer"],
        }),
        subdivision({
          id: "sub-k9", name: "K9", accent: "#b08968",
          bannerTitle: "K9 Unit", bannerSubtitle: "Detection & apprehension",
          ranks: ["K9 Commander", "K9 Handler"],
        }),
        subdivision({
          id: "sub-traffic", name: "Traffic", accent: "#f59e0b",
          bannerTitle: "Traffic Unit", bannerSubtitle: "Enforcement & collision response",
          ranks: ["Traffic Commander", "Traffic Officer"],
        }),
      ];
      return cfg;
    },
  },
  {
    id: "fire",
    label: "Fire Department",
    desc: "Red & charcoal theme, fire service ranks, Suppression / EMS / Rescue subdivisions, and a starter SOPs page.",
    swatch: ["#e04646", "#190c0c"],
    build() {
      const cfg = cloneDefaultConfig();
      applyCommon(cfg, {
        name: "Fire Department",
        organization: "Fire & Rescue",
        headline: "Fire suppression, rescue, and emergency medical response.",
        colors: { primary: "#e04646", hover: "#ea6a6a", bg: "#221111", surface1: "#2a1414", surface2: "#3a1d1d", bodyBg: "#190c0c" },
      });
      cfg.roster.subdivisions = [
        subdivision({
          id: "sub-suppression", name: "Suppression", main: true, accent: "#e04646",
          bannerTitle: "Suppression Division", bannerSubtitle: "Engine & ladder companies",
          ranks: ["Fire Chief", "Assistant Chief", "Battalion Chief", "Captain", "Lieutenant", "Engineer", "Firefighter", "Probationary Firefighter"],
        }),
        subdivision({
          id: "sub-ems", name: "EMS", accent: "#22b8cf",
          bannerTitle: "EMS Division", bannerSubtitle: "Emergency medical services",
          ranks: ["EMS Chief", "Paramedic", "EMT"],
        }),
        subdivision({
          id: "sub-rescue", name: "Technical Rescue", accent: "#f59e0b",
          bannerTitle: "Technical Rescue", bannerSubtitle: "Extrication & special operations",
          ranks: ["Rescue Captain", "Rescue Technician"],
        }),
      ];
      return cfg;
    },
  },
  {
    id: "ems",
    label: "EMS / Medical",
    desc: "Teal theme, medical ranks, Operations / Critical Care subdivisions, and a starter SOPs page.",
    swatch: ["#14b8a6", "#071512"],
    build() {
      const cfg = cloneDefaultConfig();
      applyCommon(cfg, {
        name: "Emergency Medical Services",
        organization: "Emergency Medicine",
        headline: "Pre-hospital care — crews, certifications, and protocols.",
        colors: { primary: "#14b8a6", hover: "#2dd4bf", bg: "#0c1f1b", surface1: "#0f2722", surface2: "#15362f", bodyBg: "#071512" },
      });
      cfg.roster.subdivisions = [
        subdivision({
          id: "sub-ops", name: "Operations", main: true, accent: "#14b8a6",
          bannerTitle: "EMS Operations", bannerSubtitle: "Ambulance crews & response",
          ranks: ["Medical Director", "EMS Chief", "Supervisor", "Paramedic", "Advanced EMT", "EMT", "Probationary EMT"],
        }),
        subdivision({
          id: "sub-ccp", name: "Critical Care", accent: "#a855f7",
          bannerTitle: "Critical Care", bannerSubtitle: "Flight & critical care transport",
          ranks: ["Critical Care Lead", "Critical Care Paramedic", "Flight Nurse"],
        }),
      ];
      return cfg;
    },
  },
];
