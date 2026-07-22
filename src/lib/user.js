/*
 * User display helpers. Works for both a Discord-authenticated user (which
 * carries id + avatar hash) and the gated backend dev-login user.
 */
import { groupLabel } from "./permissions.js";

export function userAvatar(user) {
  if (!user) return "https://cdn.discordapp.com/embed/avatars/0.png";
  if (user.avatarUrl) return user.avatarUrl;
  if (user.avatar && user.id) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=80`;
  }
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

// The name to show for a user: SSRP guild nickname first, then Discord
// global display name, then username.
export function userDisplayName(user) {
  return user?.displayName || user?.globalName || user?.username || "Member";
}

export function userRoleLabel(user, config) {
  if (!user) return "";
  // Not in any permission group, a regular view-only member.
  if (!config?.groups?.some((g) => g.id === user.group)) return "Member";
  return groupLabel(config, user.group);
}

// Initials for the logo fallback / avatar placeholder.
export function initials(text = "") {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
