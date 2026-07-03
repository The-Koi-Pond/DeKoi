import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { ChatSettingsThreadRecord } from "./chat-settings-thread-record";

export function getCompanionSettingsViewModel({
  activeThread,
  characters,
  threadLabel,
}: {
  activeThread: ChatSettingsThreadRecord | null;
  characters: readonly CharacterRecord[];
  threadLabel: string;
}) {
  const settingsCharacterById = new Map(characters.map((character) => [character.id, character]));
  const selectedCompanionIds = activeThread?.characterIds ?? [];
  const selectedCompanionNames = activeThread
    ? activeThread.characterIds.flatMap((characterId) => {
        const character = settingsCharacterById.get(characterId);
        return character ? [character.displayName] : [];
      })
    : [];
  const missingCompanionIds = selectedCompanionIds.filter(
    (characterId) => !settingsCharacterById.has(characterId),
  );
  const selectedCompanionCount = selectedCompanionNames.length;
  const missingCompanionCount = missingCompanionIds.length;
  const companionDrawerSummary = !activeThread
    ? `No active ${threadLabel} thread`
    : missingCompanionCount > 0
      ? `${selectedCompanionNames.length} selected, ${missingCompanionCount} missing`
      : selectedCompanionCount === 0
        ? "No companions selected"
        : `${selectedCompanionCount} selected`;
  const companionSelectionLabel =
    selectedCompanionNames.join(", ") ||
    (missingCompanionCount > 0
      ? `${missingCompanionCount} missing companion${missingCompanionCount === 1 ? "" : "s"}`
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
  activeThread,
  lorebooks,
  threadLabel,
}: {
  activeThread: ChatSettingsThreadRecord | null;
  lorebooks: readonly LorebookRecord[];
  threadLabel: string;
}) {
  const settingsLorebookById = new Map(lorebooks.map((lorebook) => [lorebook.id, lorebook]));
  const selectedLorebookIds = activeThread?.lorebookIds ?? [];
  const selectedLorebookNames = activeThread
    ? activeThread.lorebookIds.flatMap((lorebookId) => {
        const lorebook = settingsLorebookById.get(lorebookId);
        return lorebook ? [lorebook.title] : [];
      })
    : [];
  const missingLorebookIds = selectedLorebookIds.filter(
    (lorebookId) => !settingsLorebookById.has(lorebookId),
  );
  const selectedLorebookCount = selectedLorebookNames.length;
  const missingLorebookCount = missingLorebookIds.length;
  const lorebookDrawerSummary = !activeThread
    ? `No active ${threadLabel} thread`
    : missingLorebookCount > 0
      ? `${selectedLorebookNames.length} selected, ${missingLorebookCount} missing`
      : selectedLorebookCount === 0
        ? "No lorebooks selected"
        : `${selectedLorebookCount} lorebook${selectedLorebookCount === 1 ? "" : "s"}`;

  return {
    lorebookDrawerSummary,
    missingLorebookCount,
    selectedLorebookIds,
  };
}
