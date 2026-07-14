import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type {
  MessengerModeThread,
  RoleplayModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import { getRoleplayThreadPreview } from "../../../modes";
import { getMessengerCardDetails } from "./messenger-card-details";

export function filterShoalMessengerThreads(
  threads: readonly MessengerModeThread[],
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
  threads: readonly RoleplayModeThread[],
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
