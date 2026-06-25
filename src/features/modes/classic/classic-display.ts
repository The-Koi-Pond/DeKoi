import type { ClassicThread } from "../../../engine/classic";
import type { ShoalSortMode } from "../../../engine/app-settings";

export function sortClassicThreadsByUpdatedAt(threads: ClassicThread[]) {
  return [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function sortClassicThreads(
  threads: ClassicThread[],
  sortMode: ShoalSortMode,
) {
  const sortedThreads = [...threads];

  if (sortMode === "oldest") {
    return sortedThreads.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  if (sortMode === "title") {
    return sortedThreads.sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  return sortedThreads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getClassicThreadInitials(title: string) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "C";
}

export function getClassicThreadPreview(thread: ClassicThread) {
  const lastEntry = thread.entries.at(-1);
  if (lastEntry) return `${lastEntry.label}: ${lastEntry.body}`;
  return thread.sceneText || "No scene text yet";
}
