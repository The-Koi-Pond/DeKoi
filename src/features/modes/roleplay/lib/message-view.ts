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

export function isOwnRoleplayEntry(entry: RoleplayEntry) {
  return entry.role === "persona" || entry.role === "narration";
}
