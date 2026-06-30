import type { ShoalSortMode } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import {
  getMessengerThreadActivityAt,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import {
  getRoleplayThreadPreview,
  sortMessengerThreads,
  sortRoleplayThreads,
} from "../../../modes";
import { getMessengerCardDetails } from "./thread-card-details";

interface ThreadShoalListsInput {
  characterById: Map<string, CharacterRecord>;
  messengerThreads: readonly MessengerThread[];
  query: string;
  roleplayThreads: readonly RoleplayThread[];
  sortMode: ShoalSortMode;
}

export interface ThreadShoalLists {
  messengerThreads: MessengerThread[];
  roleplayThreads: RoleplayThread[];
}

export function getThreadShoalLists({
  characterById,
  messengerThreads,
  query,
  roleplayThreads,
  sortMode,
}: ThreadShoalListsInput): ThreadShoalLists {
  const sortedMessengerThreads = getSortedShoalMessengerThreads(
    messengerThreads,
    sortMode,
    characterById,
  );
  const sortedRoleplayThreads = sortRoleplayThreads([...roleplayThreads], sortMode);
  const normalizedQuery = query.trim().toLowerCase();

  return {
    messengerThreads: filterShoalMessengerThreads(
      sortedMessengerThreads,
      normalizedQuery,
      characterById,
    ),
    roleplayThreads: filterShoalRoleplayThreads(
      sortedRoleplayThreads,
      normalizedQuery,
    ),
  };
}

function getSortedShoalMessengerThreads(
  threads: readonly MessengerThread[],
  sortMode: ShoalSortMode,
  characterById: Map<string, CharacterRecord>,
) {
  if (sortMode !== "title") {
    return sortMessengerThreads([...threads], sortMode);
  }

  return [...threads].sort((a, b) => {
    const aDetails = getMessengerCardDetails(a, characterById);
    const bDetails = getMessengerCardDetails(b, characterById);
    return (
      aDetails.name.localeCompare(bDetails.name, undefined, {
        sensitivity: "base",
      }) ||
      getMessengerThreadActivityAt(b).localeCompare(
        getMessengerThreadActivityAt(a),
      )
    );
  });
}

function filterShoalMessengerThreads(
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

function filterShoalRoleplayThreads(
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
