/*
 * User display helpers. Works for both the dev-login mock user and a real
 * Discord-authenticated user (which carries id + avatar hash).
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

export function userRoleLabel(user, config) {
  if (!user) return "";
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
