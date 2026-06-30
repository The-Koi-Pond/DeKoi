import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
} from "../../../modes";

export function getMessengerCardDetails(
  thread: MessengerThread,
  characterById: Map<string, CharacterRecord>,
) {
  const companions = thread.characterIds.flatMap((characterId) => {
    const companion = characterById.get(characterId);
    return companion ? [companion] : [];
  });
  const missingCount = thread.characterIds.length - companions.length;
  const name =
    companions.map((companion) => companion.displayName).join(" + ") ||
    (missingCount > 0 ? "Missing companion" : "No companion");
  const threadTitle = thread.title.trim();
  const displayName =
    threadTitle && !/^New Messenger \d+$/i.test(threadTitle) ? threadTitle : name;
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
