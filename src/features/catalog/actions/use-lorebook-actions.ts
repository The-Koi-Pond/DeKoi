import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/character";
import { removeCharacterLorebook } from "../../../engine/character-actions";
import type { ClassicThread } from "../../../engine/classic";
import { removeClassicThreadLorebook } from "../../../engine/classic-actions";
import type { LorebookRecord } from "../../../engine/lorebook";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
  deleteLorebookEntry as deleteLorebookEntryRecord,
  deleteLorebookRecord,
  duplicateLorebookEntryRecord,
  updateLorebookEntryRecord,
  updateLorebookRecord,
  upsertLorebookEntry,
  type LorebookEntryInput,
  type LorebookInput,
} from "../../../engine/lorebook-actions";
import type { MessengerThread } from "../../../engine/messenger";
import { removeMessengerThreadLorebook } from "../../../engine/messenger-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseLorebookActionsInput = {
  lorebooks: LorebookRecord[];
  setLorebooks: StateSetter<LorebookRecord[]>;
  setCharacters: StateSetter<CharacterRecord[]>;
  setClassicThreads: StateSetter<ClassicThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function useLorebookActions({
  lorebooks,
  setLorebooks,
  setCharacters,
  setClassicThreads,
  setMessengerThreads,
}: UseLorebookActionsInput) {
  const createLorebookEntry = useCallback(
    (lorebookId: string, input: LorebookEntryInput) => {
      if (!lorebooks.some((lorebook) => lorebook.id === lorebookId)) {
        return null;
      }

      const now = currentIsoTimestamp();
      const entry = createLorebookEntryRecord({
        id: createRecordId("lore-entry"),
        input,
        now,
      });

      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;
          return upsertLorebookEntry(lorebook, entry, now);
        }),
      );

      return entry;
    },
    [lorebooks, setLorebooks],
  );

  const updateLorebookEntry = useCallback(
    (lorebookId: string, entryId: string, input: LorebookEntryInput) => {
      const now = currentIsoTimestamp();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;

          const entry = lorebook.entries.find(
            (currentEntry) => currentEntry.id === entryId,
          );
          if (!entry) return lorebook;

          return upsertLorebookEntry(
            lorebook,
            updateLorebookEntryRecord(entry, input, now),
            now,
          );
        }),
      );
    },
    [setLorebooks],
  );

  const duplicateLorebookEntry = useCallback(
    (lorebookId: string, entryId: string) => {
      const lorebook = lorebooks.find(
        (currentLorebook) => currentLorebook.id === lorebookId,
      );
      const entry = lorebook?.entries.find(
        (currentEntry) => currentEntry.id === entryId,
      );
      if (!entry) return null;

      const now = currentIsoTimestamp();
      const duplicatedEntry = duplicateLorebookEntryRecord(
        entry,
        createRecordId("lore-entry"),
        now,
      );

      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;
          return upsertLorebookEntry(lorebook, duplicatedEntry, now);
        }),
      );

      return duplicatedEntry;
    },
    [lorebooks, setLorebooks],
  );

  const deleteLorebookEntry = useCallback(
    (lorebookId: string, entryId: string) => {
      const now = currentIsoTimestamp();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) =>
          lorebook.id === lorebookId
            ? deleteLorebookEntryRecord(lorebook, entryId, now)
            : lorebook,
        ),
      );
    },
    [setLorebooks],
  );

  const createLorebook = useCallback(
    (input: LorebookInput) => {
      const now = currentIsoTimestamp();
      const lorebook = createLorebookRecord({
        id: createRecordId("lorebook"),
        input,
        now,
      });
      setLorebooks((currentLorebooks) => [lorebook, ...currentLorebooks]);
      return lorebook;
    },
    [setLorebooks],
  );

  const updateLorebook = useCallback(
    (lorebookId: string, input: LorebookInput) => {
      const now = currentIsoTimestamp();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) =>
          lorebook.id === lorebookId
            ? updateLorebookRecord(lorebook, input, now)
            : lorebook,
        ),
      );
    },
    [setLorebooks],
  );

  const deleteLorebook = useCallback(
    (lorebookId: string) => {
      const now = currentIsoTimestamp();
      setLorebooks((currentLorebooks) =>
        deleteLorebookRecord(currentLorebooks, lorebookId),
      );
      setCharacters((currentCharacters) =>
        currentCharacters.map((character) =>
          removeCharacterLorebook(character, lorebookId, now),
        ),
      );
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          removeMessengerThreadLorebook(thread, lorebookId, now),
        ),
      );
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          removeClassicThreadLorebook(thread, lorebookId, now),
        ),
      );
    },
    [setCharacters, setClassicThreads, setLorebooks, setMessengerThreads],
  );

  return {
    createLorebookEntry,
    updateLorebookEntry,
    duplicateLorebookEntry,
    deleteLorebookEntry,
    createLorebook,
    updateLorebook,
    deleteLorebook,
  };
}
