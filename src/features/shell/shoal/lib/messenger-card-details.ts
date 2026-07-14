import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerModeThread } from "../../../../engine/contracts/types/mode-thread";
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { getMessengerThreadInitials, getMessengerThreadPreview } from "../../../modes";

export function getMessengerCardDetails(
  thread: MessengerModeThread,
  characterById: Map<string, CharacterRecord>,
) {
  const branch = getActiveModeBranch(thread);
  const companions = branch.characterIds.flatMap((characterId) => {
    const companion = characterById.get(characterId);
    return companion ? [companion] : [];
  });
  const missingCount = branch.characterIds.length - companions.length;
  const name =
    companions.map((companion) => companion.displayName).join(" + ") ||
    (missingCount > 0 ? "Missing companion" : "No companion");
  const threadTitle = thread.title.trim();
  const displayName = threadTitle && !/^New Messenger \d+$/i.test(threadTitle) ? threadTitle : name;
  const preview = getMessengerThreadPreview(thread);
  const searchText = [
    displayName,
    name,
    threadTitle,
    preview,
    ...companions.flatMap((companion) => [
      companion.nickname ?? "",
      companion.personality,
      companion.description,
      companion.scenario,
      companion.tags.join(" "),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return {
    avatarUrl: companions[0]?.avatarUrl ?? null,
    initials: getMessengerThreadInitials(name),
    name: displayName,
    preview,
    searchText,
  };
}
