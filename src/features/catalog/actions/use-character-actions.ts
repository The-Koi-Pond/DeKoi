import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import {
  createCharacterRecord,
  deleteCharacterRecord,
  duplicateCharacterRecord,
  updateCharacterRecord,
  type CharacterRecordInput,
} from "../../../engine/catalog/character-actions";
import type { ModeThread } from "../../../engine/contracts/types/mode-thread";
import { removeModeThreadCharacter } from "../../../engine/modes/mode-thread/mode-thread-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseCharacterActionsInput = {
  characters: CharacterRecord[];
  setCharacters: StateSetter<CharacterRecord[]>;
  setModeThreads: StateSetter<ModeThread[]>;
};

export function useCharacterActions({
  characters,
  setCharacters,
  setModeThreads,
}: UseCharacterActionsInput) {
  const createCharacter = useCallback(
    (input: CharacterRecordInput) => {
      const now = currentIsoTimestamp();
      const character = createCharacterRecord({
        id: createRecordId("character"),
        input,
        now,
      });
      setCharacters((currentCharacters) => [character, ...currentCharacters]);
      return character;
    },
    [setCharacters],
  );

  const updateCharacter = useCallback(
    (characterId: string, input: CharacterRecordInput) => {
      const now = currentIsoTimestamp();
      setCharacters((currentCharacters) =>
        currentCharacters.map((character) =>
          character.id === characterId ? updateCharacterRecord(character, input, now) : character,
        ),
      );
    },
    [setCharacters],
  );

  const duplicateCharacter = useCallback(
    (characterId: string) => {
      const character = characters.find((currentCharacter) => currentCharacter.id === characterId);
      if (!character) return null;

      const now = currentIsoTimestamp();
      const duplicatedCharacter = duplicateCharacterRecord(
        character,
        createRecordId("character"),
        now,
      );
      setCharacters((currentCharacters) => [duplicatedCharacter, ...currentCharacters]);
      return duplicatedCharacter;
    },
    [characters, setCharacters],
  );

  const deleteCharacter = useCallback(
    (characterId: string) => {
      const now = currentIsoTimestamp();
      setCharacters((currentCharacters) => deleteCharacterRecord(currentCharacters, characterId));
      setModeThreads((currentThreads) =>
        currentThreads.map((thread) => removeModeThreadCharacter(thread, characterId, now)),
      );
    },
    [setCharacters, setModeThreads],
  );

  return {
    createCharacter,
    updateCharacter,
    duplicateCharacter,
    deleteCharacter,
  };
}
