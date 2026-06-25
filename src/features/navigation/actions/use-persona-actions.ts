import { useCallback } from "react";
import type { ClassicThread } from "../../../engine/classic";
import { clearClassicThreadPersona } from "../../../engine/classic-actions";
import type { MessengerThread } from "../../../engine/messenger";
import { clearMessengerThreadPersona } from "../../../engine/messenger-actions";
import type { PersonaRecord } from "../../../engine/persona";
import {
  createPersonaRecord,
  deletePersonaRecord,
  duplicatePersonaRecord,
  updatePersonaRecord,
  type PersonaRecordInput,
} from "../../../engine/persona-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../state/state-setter";

type UsePersonaActionsInput = {
  personas: PersonaRecord[];
  setPersonas: StateSetter<PersonaRecord[]>;
  setClassicThreads: StateSetter<ClassicThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function usePersonaActions({
  personas,
  setPersonas,
  setClassicThreads,
  setMessengerThreads,
}: UsePersonaActionsInput) {
  const createPersona = useCallback(
    (input: PersonaRecordInput) => {
      const now = currentIsoTimestamp();
      const persona = createPersonaRecord({
        id: createRecordId("persona"),
        input,
        now,
      });
      setPersonas((currentPersonas) => [persona, ...currentPersonas]);
      return persona;
    },
    [setPersonas],
  );

  const updatePersona = useCallback(
    (personaId: string, input: PersonaRecordInput) => {
      const now = currentIsoTimestamp();
      setPersonas((currentPersonas) =>
        currentPersonas.map((persona) =>
          persona.id === personaId
            ? updatePersonaRecord(persona, input, now)
            : persona,
        ),
      );
    },
    [setPersonas],
  );

  const duplicatePersona = useCallback(
    (personaId: string) => {
      const persona = personas.find(
        (currentPersona) => currentPersona.id === personaId,
      );
      if (!persona) return null;

      const now = currentIsoTimestamp();
      const duplicatedPersona = duplicatePersonaRecord(
        persona,
        createRecordId("persona"),
        now,
      );
      setPersonas((currentPersonas) => [duplicatedPersona, ...currentPersonas]);
      return duplicatedPersona;
    },
    [personas, setPersonas],
  );

  const deletePersona = useCallback(
    (personaId: string) => {
      const now = currentIsoTimestamp();
      setPersonas((currentPersonas) =>
        deletePersonaRecord(currentPersonas, personaId),
      );
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          clearMessengerThreadPersona(thread, personaId, now),
        ),
      );
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          clearClassicThreadPersona(thread, personaId, now),
        ),
      );
    },
    [setClassicThreads, setMessengerThreads, setPersonas],
  );

  return {
    createPersona,
    updatePersona,
    duplicatePersona,
    deletePersona,
  };
}
