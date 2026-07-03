import type { RoleplayEntry } from "../../../../engine/contracts/types/roleplay";

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Entries staged on the persona (right) side of the scene. Narration and OOC
 * are not dialogue and are never staged — they render as distinct variants per
 * DESIGN.md §8 Roleplay.
 */
export function isOwnRoleplayEntry(entry: RoleplayEntry) {
  return entry.role === "persona";
}

export function getCopyableRoleplayEntryBody(entry: RoleplayEntry) {
  return entry.body.trim() ? entry.body : null;
}
