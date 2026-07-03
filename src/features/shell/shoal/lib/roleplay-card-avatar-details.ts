import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { getMessengerThreadInitials } from "../../../modes";

export function getRoleplayCardAvatarDetails(
  characterIds: string[],
  fallbackName: string,
  characterById: Map<string, CharacterRecord>,
) {
  const uniqueCharacterIds = [...new Set(characterIds)];
  const resolvedCharacters = uniqueCharacterIds.flatMap((characterId) => {
    const companion = characterById.get(characterId);
    return companion ? [companion] : [];
  });
  const uniqueCharacterCount = uniqueCharacterIds.length;
  const resolvedCharacterCount = resolvedCharacters.length;
  const missingCharacterCount = uniqueCharacterCount - resolvedCharacterCount;
  const companion = resolvedCharacters[0] ?? null;
  const avatarLabel =
    companion?.displayName ?? (missingCharacterCount > 0 ? "Missing companion" : fallbackName);

  return {
    avatarLabel,
    avatarUrl: companion?.avatarUrl ?? null,
    hasCharacter: companion !== null,
    initials: getMessengerThreadInitials(avatarLabel),
    missingCharacterCount,
    resolvedCharacterCount,
    uniqueCharacterCount,
  };
}
