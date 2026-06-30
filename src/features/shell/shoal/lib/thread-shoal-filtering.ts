import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { getRoleplayThreadPreview } from "../../../modes";
import { getMessengerCardDetails } from "./messenger-card-details";

export function filterShoalMessengerThreads(
  threads: readonly MessengerThread[],
  normalizedQuery: string,
  characterById: Map<string, CharacterRecord>,
) {
  if (!normalizedQuery) return [...threads];

  return threads.filter((thread) => {
    const details = getMessengerCardDetails(thread, characterById);
    return details.searchText.includes(normalizedQuery);
  });
}

export function filterShoalRoleplayThreads(
  threads: readonly RoleplayThread[],
  normalizedQuery: string,
) {
  if (!normalizedQuery) return [...threads];

  return threads.filter((thread) => {
    const preview = getRoleplayThreadPreview(thread);
    return (
      thread.title.toLowerCase().includes(normalizedQuery) ||
      preview.toLowerCase().includes(normalizedQuery)
    );
  });
}
