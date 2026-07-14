import type { RoleplayModeThread } from "../../../engine/contracts/types/mode-thread";
import {
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
  getModeThreadActivityAt,
} from "../../../engine/modes/mode-thread/mode-thread-actions";
import type { ShoalSortMode } from "../../../engine/contracts/types/app-settings";

export function sortRoleplayThreadsByUpdatedAt(threads: RoleplayModeThread[]) {
  return [...threads].sort((a, b) =>
    getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
  );
}

export function sortRoleplayThreads(threads: RoleplayModeThread[], sortMode: ShoalSortMode) {
  const sortedThreads = [...threads];
  if (sortMode === "oldest")
    return sortedThreads.sort((a, b) =>
      getModeThreadActivityAt(a).localeCompare(getModeThreadActivityAt(b)),
    );
  if (sortMode === "title")
    return sortedThreads.sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
    );
  return sortedThreads.sort((a, b) =>
    getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a)),
  );
}

export function getRoleplayThreadPreview(thread: RoleplayModeThread) {
  const lastMessage = getActiveModeBranchMessages(thread).at(-1);
  if (lastMessage)
    return `${lastMessage.author.label}: ${getActiveModeMessageVersion(lastMessage).body}`;
  return "No messages yet";
}
