import { useCallback } from "react";
import type { RoleplayThread } from "../../../engine/roleplay";
import { clearRoleplayThreadPersona } from "../../../engine/modes/roleplay/roleplay-actions";
import type { MessengerThread } from "../../../engine/messenger";
import { clearMessengerThreadPersona } from "../../../engine/modes/messenger/messenger-actions";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import {
  createPersonaRecord,
  deletePersonaRecord,
  duplicatePersonaRecord,
  updatePersonaRecord,
  type PersonaRecordInput,
} from "../../../engine/persona-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UsePersonaActionsInput = {
  personas: PersonaRecord[];
  setPersonas: StateSetter<PersonaRecord[]>;
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function usePersonaActions({
  personas,
  setPersonas,
  setRoleplayThreads,
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
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          clearRoleplayThreadPersona(thread, personaId, now),
        ),
      );
    },
    [setRoleplayThreads, setMessengerThreads, setPersonas],
  );

  return {
    createPersona,
    updatePersona,
    duplicatePersona,
    deletePersona,
  };
}
