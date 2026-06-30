import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";

export function getCompanionSettingsViewModel({
  activeMessengerThread,
  characters,
}: {
  activeMessengerThread: MessengerThread | null;
  characters: readonly CharacterRecord[];
}) {
  const settingsCharacterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  const selectedCompanionIds = activeMessengerThread?.characterIds ?? [];
  const selectedCompanionNames = activeMessengerThread
    ? activeMessengerThread.characterIds.flatMap((characterId) => {
        const character = settingsCharacterById.get(characterId);
        return character ? [character.displayName] : [];
      })
    : [];
  const missingCompanionIds = selectedCompanionIds.filter(
    (characterId) => !settingsCharacterById.has(characterId),
  );
  const selectedCompanionCount = selectedCompanionNames.length;
  const missingCompanionCount = missingCompanionIds.length;
  const companionDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingCompanionCount > 0
      ? `${selectedCompanionNames.length} selected, ${missingCompanionCount} missing`
      : selectedCompanionCount === 0
        ? "No companions selected"
        : `${selectedCompanionCount} selected`;
  const companionSelectionLabel =
    selectedCompanionNames.join(", ") ||
    (missingCompanionCount > 0
      ? `${missingCompanionCount} missing companion${
          missingCompanionCount === 1 ? "" : "s"
        }`
      : "Choose companions");

  return {
    companionDrawerSummary,
    companionSelectionLabel,
    missingCompanionCount,
    selectedCompanionCount,
    selectedCompanionIds,
  };
}

export function getLorebookSettingsViewModel({
  activeMessengerThread,
  lorebooks,
}: {
  activeMessengerThread: MessengerThread | null;
  lorebooks: readonly LorebookRecord[];
}) {
  const settingsLorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook]),
  );
  const selectedLorebookIds = activeMessengerThread?.lorebookIds ?? [];
  const selectedLorebookNames = activeMessengerThread
    ? activeMessengerThread.lorebookIds.flatMap((lorebookId) => {
        const lorebook = settingsLorebookById.get(lorebookId);
        return lorebook ? [lorebook.title] : [];
      })
    : [];
  const missingLorebookIds = selectedLorebookIds.filter(
    (lorebookId) => !settingsLorebookById.has(lorebookId),
  );
  const selectedLorebookCount = selectedLorebookNames.length;
  const missingLorebookCount = missingLorebookIds.length;
  const lorebookDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingLorebookCount > 0
      ? `${selectedLorebookNames.length} selected, ${missingLorebookCount} missing`
      : selectedLorebookCount === 0
        ? "No lorebooks selected"
        : `${selectedLorebookCount} lorebook${
            selectedLorebookCount === 1 ? "" : "s"
          }`;

  return {
    lorebookDrawerSummary,
    missingLorebookCount,
    selectedLorebookIds,
  };
}
