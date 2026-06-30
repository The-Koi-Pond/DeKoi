import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { getMessengerThreadInitials } from "../../../modes";

export function getRoleplayCardAvatarDetails(
  characterIds: string[],
  fallbackName: string,
  characterById: Map<string, CharacterRecord>,
) {
  const companion =
    characterIds
      .map((characterId) => characterById.get(characterId) ?? null)
      .find((candidate): candidate is CharacterRecord => candidate !== null) ??
    null;
  const avatarLabel = companion?.displayName ?? fallbackName;

  return {
    avatarLabel,
    avatarUrl: companion?.avatarUrl ?? null,
    hasCharacter: companion !== null,
    initials: getMessengerThreadInitials(avatarLabel),
  };
}
