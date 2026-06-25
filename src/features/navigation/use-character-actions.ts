import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { CharacterRecord } from "../../engine/character";
import {
  createCharacterRecord,
  deleteCharacterRecord,
  duplicateCharacterRecord,
  updateCharacterRecord,
  type CharacterRecordInput,
} from "../../engine/character-actions";
import type { ClassicThread } from "../../engine/classic";
import { removeClassicThreadCharacter } from "../../engine/classic-actions";
import type { MessengerThread } from "../../engine/messenger";
import { removeMessengerThreadCharacter } from "../../engine/messenger-actions";
import { currentIsoTimestamp } from "../../shared/browser/current-time";
import { createRecordId } from "../../shared/browser/record-id";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseCharacterActionsInput = {
  characters: CharacterRecord[];
  setCharacters: StateSetter<CharacterRecord[]>;
  setClassicThreads: StateSetter<ClassicThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function useCharacterActions({
  characters,
  setCharacters,
  setClassicThreads,
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
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          removeClassicThreadCharacter(thread, characterId, now),
        ),
      );
    },
    [setCharacters, setClassicThreads, setMessengerThreads],
  );

  return {
    createCharacter,
    updateCharacter,
    duplicateCharacter,
    deleteCharacter,
  };
}
