import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { getMessengerThreadInitials } from "../../../modes";

export function getRoleplayCardAvatarDetails(
  characterIds: string[],
  fallbackName: string,
  characterById: Map<string, CharacterRecord>,
) {
  const uniqueCharacterIds = [...new Set(characterIds)];
  const companions = uniqueCharacterIds.flatMap((characterId) => {
    const companion = characterById.get(characterId);
    return companion ? [companion] : [];
  });
  const missingCharacterCount = uniqueCharacterIds.length - companions.length;
  const companion =
    companions.find((candidate): candidate is CharacterRecord => !!candidate) ??
    null;
  const avatarLabel =
    companion?.displayName ??
    (missingCharacterCount > 0 ? "Missing companion" : fallbackName);

  return {
    avatarLabel,
    avatarUrl: companion?.avatarUrl ?? null,
    hasCharacter: companion !== null,
    initials: getMessengerThreadInitials(avatarLabel),
    missingCharacterCount,
  };
}
