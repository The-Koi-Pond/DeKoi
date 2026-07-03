import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { getDraftCompanionName, getDraftRoleplayName } from "./new-thread-draft-names";
import {
  getCompanionSelectionLabel,
  getLorebookSelectionLabel,
} from "./new-thread-selection-labels";

interface NewThreadLabelsInput {
  characterById: Map<string, CharacterRecord>;
  lorebooks: LorebookRecord[];
  nextMessengerThreadNumber: number;
  nextRoleplayThreadNumber: number;
}

export function createNewThreadLabels({
  characterById,
  lorebooks,
  nextMessengerThreadNumber,
  nextRoleplayThreadNumber,
}: NewThreadLabelsInput) {
  return {
    getCompanionLabel: (characterIds: string[]) =>
      getCompanionSelectionLabel(characterIds, characterById),
    getDraftCompanionName: (characterIds: string[]) =>
      getDraftCompanionName(characterIds, characterById, nextMessengerThreadNumber),
    getDraftRoleplayName: (characterIds: string[]) =>
      getDraftRoleplayName(characterIds, characterById, nextRoleplayThreadNumber),
    getLorebookLabel: (lorebookIds: string[]) => getLorebookSelectionLabel(lorebookIds, lorebooks),
  };
}

export type NewThreadLabels = ReturnType<typeof createNewThreadLabels>;

export {
  getCompanionSelectionLabel,
  getDraftCompanionName,
  getDraftRoleplayName,
  getLorebookSelectionLabel,
};
