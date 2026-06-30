import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

export function getDraftCompanionName(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
  fallbackNumber: number,
) {
  return (
    characterIds
      .map((characterId) => characterById.get(characterId)?.displayName ?? "")
      .filter(Boolean)
      .join(" + ") || `New Messenger ${fallbackNumber}`
  );
}

export function getDraftRoleplayName(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
  fallbackNumber: number,
) {
  return (
    characterIds
      .map((characterId) => characterById.get(characterId)?.displayName ?? "")
      .filter(Boolean)
      .join(" + ") || `New Roleplay ${fallbackNumber}`
  );
}

export function getCompanionSelectionLabel(
  characterIds: string[],
  characterById: Map<string, CharacterRecord>,
) {
  const names = characterIds
    .map((characterId) => characterById.get(characterId)?.displayName ?? "")
    .filter(Boolean);

  if (names.length === 0) return "Select companions";
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
}

export function getLorebookSelectionLabel(
  lorebookIds: string[],
  lorebooks: LorebookRecord[],
) {
  const lorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook.title]),
  );
  const names = lorebookIds
    .map((lorebookId) => lorebookById.get(lorebookId) ?? "")
    .filter(Boolean);

  if (names.length === 0) return "No lorebooks";
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
}
