import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { getCompanionLabelDetails } from "./new-thread-selection-labels";

export function getDraftCompanionName(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
  fallbackNumber: number,
) {
  const { missingCount, names } = getCompanionLabelDetails(
    characterIds,
    characterById,
  );
  if (missingCount > 0 && names.length === 0) return "Missing companion selection";
  if (missingCount > 0) {
    return `${names.join(" + ")} + ${missingCount} missing`;
  }
  return names.join(" + ") || `New Messenger ${fallbackNumber}`;
}

export function getDraftRoleplayName(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
  fallbackNumber: number,
) {
  const { missingCount, names } = getCompanionLabelDetails(
    characterIds,
    characterById,
  );
  if (missingCount > 0 && names.length === 0) return "Missing companion selection";
  if (missingCount > 0) {
    return `${names.join(" + ")} + ${missingCount} missing`;
  }
  return names.join(" + ") || `New Roleplay ${fallbackNumber}`;
}
