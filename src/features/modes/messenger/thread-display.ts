import type { MessengerModeThread } from "../../../engine/contracts/types/mode-thread";
import {
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
  getModeThreadActivityAt,
} from "../../../engine/modes/mode-thread/mode-thread-actions";
import type { ShoalSortMode } from "../../../engine/contracts/types/app-settings";

export function sortMessengerThreadsByUpdatedAt(threads: MessengerModeThread[]) {
  return [...threads].sort((a, b) =>
    getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
  );
}

export function sortMessengerThreads(threads: MessengerModeThread[], sortMode: ShoalSortMode) {
  const sortedThreads = [...threads];

  if (sortMode === "oldest") {
    return sortedThreads.sort((a, b) =>
      getModeThreadActivityAt(a).localeCompare(getModeThreadActivityAt(b)),
    );
  }

  if (sortMode === "title") {
    return sortedThreads.sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
    );
  }

  return sortedThreads.sort((a, b) =>
    getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
  );
}

export function getMessengerThreadInitials(title: string) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "M";
}

export function getMessengerThreadPreview(thread: MessengerModeThread) {
  const lastMessage = getActiveModeBranchMessages(thread).at(-1);
  if (!lastMessage) return "No messages yet";

  const author = lastMessage.author.kind === "persona" ? "You" : lastMessage.author.label;
  return `${author}: ${getActiveModeMessageVersion(lastMessage).body}`;
}

export function getMessengerThreadTimeLabel(updatedAt: string, now = Date.now()) {
  const updatedTime = Date.parse(updatedAt);
  if (Number.isNaN(updatedTime)) return "recently";

  const diffMs = Math.max(0, now - updatedTime);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(updatedTime));
}
