import type { ShoalSortMode } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import {
  getMessengerThreadActivityAt,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { sortMessengerThreads } from "../../../modes";
import { getMessengerCardDetails } from "./messenger-card-details";

export function getSortedShoalMessengerThreads(
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
