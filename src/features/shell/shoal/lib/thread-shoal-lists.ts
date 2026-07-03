import type { ShoalSortMode } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { sortRoleplayThreads } from "../../../modes";
import { filterShoalMessengerThreads, filterShoalRoleplayThreads } from "./thread-shoal-filtering";
import { getSortedShoalMessengerThreads } from "./thread-shoal-sorting";

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
    roleplayThreads: filterShoalRoleplayThreads(sortedRoleplayThreads, normalizedQuery),
  };
}
