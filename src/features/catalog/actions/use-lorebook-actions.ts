import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import { removeCharacterLorebook } from "../../../engine/catalog/character-actions";
import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { ModeThread } from "../../../engine/contracts/types/mode-thread";
import { removeModeThreadLorebook } from "../../../engine/modes/mode-thread/mode-thread-actions";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
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
} from "../../../engine/catalog/lorebook-actions";
import { removePersonaLorebook } from "../../../engine/catalog/persona-actions";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseLorebookActionsInput = {
  lorebooks: LorebookRecord[];
  setLorebooks: StateSetter<LorebookRecord[]>;
  setAppSettings: StateSetter<AppSettings>;
  setCharacters: StateSetter<CharacterRecord[]>;
  setPersonas: StateSetter<PersonaRecord[]>;
  setModeThreads: StateSetter<ModeThread[]>;
};

export function useLorebookActions({
  lorebooks,
  setLorebooks,
  setAppSettings,
  setCharacters,
  setPersonas,
  setModeThreads,
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

          const entry = lorebook.entries.find((currentEntry) => currentEntry.id === entryId);
          if (!entry) return lorebook;

          return upsertLorebookEntry(lorebook, updateLorebookEntryRecord(entry, input, now), now);
        }),
      );
    },
    [setLorebooks],
  );

  const duplicateLorebookEntry = useCallback(
    (lorebookId: string, entryId: string) => {
      const lorebook = lorebooks.find((currentLorebook) => currentLorebook.id === lorebookId);
      const entry = lorebook?.entries.find((currentEntry) => currentEntry.id === entryId);
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
          lorebook.id === lorebookId ? deleteLorebookEntryRecord(lorebook, entryId, now) : lorebook,
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
          lorebook.id === lorebookId ? updateLorebookRecord(lorebook, input, now) : lorebook,
        ),
      );
    },
    [setLorebooks],
  );

  const deleteLorebook = useCallback(
    (lorebookId: string) => {
      const now = currentIsoTimestamp();
      setLorebooks((currentLorebooks) => deleteLorebookRecord(currentLorebooks, lorebookId));
      setCharacters((currentCharacters) =>
        currentCharacters.map((character) => removeCharacterLorebook(character, lorebookId, now)),
      );
      setPersonas((currentPersonas) =>
        currentPersonas.map((persona) => removePersonaLorebook(persona, lorebookId, now)),
      );
      setAppSettings((currentSettings) =>
        currentSettings.globalLorebookIds.includes(lorebookId)
          ? {
              ...currentSettings,
              globalLorebookIds: currentSettings.globalLorebookIds.filter(
                (id) => id !== lorebookId,
              ),
            }
          : currentSettings,
      );
      setModeThreads((currentThreads) =>
        currentThreads.map((thread) => removeModeThreadLorebook(thread, lorebookId, now)),
      );
    },
    [setAppSettings, setCharacters, setPersonas, setModeThreads, setLorebooks],
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
