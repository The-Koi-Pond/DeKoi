import {
  getRoleplayThreadActivityAt,
  type RoleplayThread,
} from "../../../engine/roleplay";
import type { ShoalSortMode } from "../../../engine/contracts/types/app-settings";

export function sortRoleplayThreadsByUpdatedAt(threads: RoleplayThread[]) {
  return [...threads].sort((a, b) =>
    getRoleplayThreadActivityAt(b).localeCompare(getRoleplayThreadActivityAt(a)),
  );
}

export function sortRoleplayThreads(
  threads: RoleplayThread[],
  sortMode: ShoalSortMode,
) {
  const sortedThreads = [...threads];

  if (sortMode === "oldest") {
    return sortedThreads.sort((a, b) =>
      getRoleplayThreadActivityAt(a).localeCompare(
        getRoleplayThreadActivityAt(b),
      ),
    );
  }

  if (sortMode === "title") {
    return sortedThreads.sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        getRoleplayThreadActivityAt(b).localeCompare(
          getRoleplayThreadActivityAt(a),
        ),
    );
  }

  return sortedThreads.sort((a, b) =>
    getRoleplayThreadActivityAt(b).localeCompare(getRoleplayThreadActivityAt(a)),
  );
}

export function getRoleplayThreadInitials(title: string) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "C";
}

export function getRoleplayThreadPreview(thread: RoleplayThread) {
  const lastEntry = thread.entries.at(-1);
  if (lastEntry) return `${lastEntry.label}: ${lastEntry.body}`;
  return thread.sceneText || "No messages yet";
}
