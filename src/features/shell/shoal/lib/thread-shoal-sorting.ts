import type { ShoalSortMode } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerModeThread } from "../../../../engine/contracts/types/mode-thread";
import { getModeThreadActivityAt } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { sortMessengerThreads } from "../../../modes";
import { getMessengerCardDetails } from "./messenger-card-details";

export function getSortedShoalMessengerThreads(
  threads: readonly MessengerModeThread[],
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
      }) || getModeThreadActivityAt(b).localeCompare(getModeThreadActivityAt(a))
    );
  });
}
