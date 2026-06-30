import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import {
  createCharacterRecord,
  deleteCharacterRecord,
  duplicateCharacterRecord,
  updateCharacterRecord,
  type CharacterRecordInput,
} from "../../../engine/catalog/character-actions";
import type { RoleplayThread } from "../../../engine/roleplay";
import { removeRoleplayThreadCharacter } from "../../../engine/modes/roleplay/roleplay-actions";
import type { MessengerThread } from "../../../engine/messenger";
import { removeMessengerThreadCharacter } from "../../../engine/modes/messenger/messenger-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseCharacterActionsInput = {
  characters: CharacterRecord[];
  setCharacters: StateSetter<CharacterRecord[]>;
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function useCharacterActions({
  characters,
  setCharacters,
  setRoleplayThreads,
  setMessengerThreads,
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
          character.id === characterId
            ? updateCharacterRecord(character, input, now)
            : character,
        ),
      );
    },
    [setCharacters],
  );

  const duplicateCharacter = useCallback(
    (characterId: string) => {
      const character = characters.find(
        (currentCharacter) => currentCharacter.id === characterId,
      );
      if (!character) return null;

      const now = currentIsoTimestamp();
      const duplicatedCharacter = duplicateCharacterRecord(
        character,
        createRecordId("character"),
        now,
      );
      setCharacters((currentCharacters) => [
        duplicatedCharacter,
        ...currentCharacters,
      ]);
      return duplicatedCharacter;
    },
    [characters, setCharacters],
  );

  const deleteCharacter = useCallback(
    (characterId: string) => {
      const now = currentIsoTimestamp();
      setCharacters((currentCharacters) =>
        deleteCharacterRecord(currentCharacters, characterId),
      );
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          removeMessengerThreadCharacter(thread, characterId, now),
        ),
      );
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          removeRoleplayThreadCharacter(thread, characterId, now),
        ),
      );
    },
    [setCharacters, setRoleplayThreads, setMessengerThreads],
  );

  return {
    createCharacter,
    updateCharacter,
    duplicateCharacter,
    deleteCharacter,
  };
}
