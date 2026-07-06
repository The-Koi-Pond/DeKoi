import { useCallback } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import {
  appendRoleplayEntries,
  clearRoleplayEntries,
  createCompanionRoleplayEntry,
  createRoleplayThread as buildRoleplayThread,
  deleteRoleplayThread as deleteRoleplayThreadRecord,
  renameRoleplayThread as renameRoleplayThreadRecord,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import { deleteLoreRuntimeStateForOwner } from "../../../../engine/lore-runtime/lore-runtime-actions";
import { deleteRippleStateForOwner } from "../../../../engine/ripples/ripple-actions";
import { currentIsoTimestamp } from "../../../../shared/browser/current-time";
import { createRecordId } from "../../../../shared/browser/record-id";
import { cleanTextArray } from "../../../../shared/text";
import type { RoleplayThreadCreateInput, PondView } from "../../../navigation";
import type { StateSetter } from "../../../../shared/react/state-setter";

type UseRoleplayThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  characters: CharacterRecord[];
  roleplayThreads: RoleplayThread[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setLoreRuntimeStates: StateSetter<LoreRuntimeState[]>;
  setRippleStates: StateSetter<RippleState[]>;
  setView: (view: PondView) => void;
  view: PondView;
  openRoleplayThread: (threadId: string) => void;
};

export function useRoleplayThreadActions({
  activeMessengerConnectionId,
  characters,
  roleplayThreads,
  personas,
  providerConnections,
  setRoleplayThreads,
  setLoreRuntimeStates,
  setRippleStates,
  setView,
  view,
  openRoleplayThread,
}: UseRoleplayThreadActionsInput) {
  const createRoleplayThread = useCallback(
    (input?: RoleplayThreadCreateInput) => {
      const now = currentIsoTimestamp();
      const activePersonaId =
        input?.activePersonaId === undefined
          ? (personas[0]?.id ?? null)
          : input.activePersonaId?.trim() || null;
      const characterIds = cleanTextArray(
        input?.characterIds ?? characters.slice(0, 1).map((companion) => companion.id),
      );
      const lorebookIds = cleanTextArray(input?.lorebookIds);
      const requestedConnectionId = input?.providerConnectionId?.trim() ?? "";
      const activeConnection =
        providerConnections.find((connection) =>
          requestedConnectionId
            ? connection.id === requestedConnectionId
            : connection.id === activeMessengerConnectionId,
        ) ??
        providerConnections[0] ??
        null;
      const thread = buildRoleplayThread({
        activePersonaId,
        characterIds,
        id: createRecordId("roleplay-thread"),
        lorebookIds,
        now,
        providerConnectionId: activeConnection?.id ?? null,
        title: input?.title?.trim() || `New Roleplay ${roleplayThreads.length + 1}`,
      });
      const openingCompanion =
        characterIds
          .map(
            (characterId) => characters.find((character) => character.id === characterId) ?? null,
          )
          .find((character) => !!character?.firstMessage.trim()) ?? null;
      const threadWithOpeningEntry = openingCompanion
        ? appendRoleplayEntries(thread, [
            createCompanionRoleplayEntry({
              body: openingCompanion.firstMessage,
              companion: openingCompanion,
              id: createRecordId("roleplay-entry"),
              now,
              thread,
            }),
          ])
        : thread;

      setRoleplayThreads((currentThreads) => [threadWithOpeningEntry, ...currentThreads]);
      openRoleplayThread(threadWithOpeningEntry.id);
      return threadWithOpeningEntry;
    },
    [
      activeMessengerConnectionId,
      characters,
      roleplayThreads.length,
      openRoleplayThread,
      personas,
      providerConnections,
      setRoleplayThreads,
    ],
  );

  const updateRoleplayThread = useCallback(
    (thread: RoleplayThread) => {
      setRoleplayThreads((currentThreads) =>
        currentThreads.some((currentThread) => currentThread.id === thread.id)
          ? currentThreads.map((currentThread) =>
              currentThread.id === thread.id ? thread : currentThread,
            )
          : [thread, ...currentThreads],
      );
    },
    [setRoleplayThreads],
  );

  const renameRoleplayThread = useCallback(
    (threadId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const now = currentIsoTimestamp();
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? renameRoleplayThreadRecord(thread, trimmedTitle, now) : thread,
        ),
      );
    },
    [setRoleplayThreads],
  );

  const clearRoleplayThreadEntries = useCallback(
    (threadId: string) => {
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? clearRoleplayEntries(thread) : thread,
        ),
      );
      setLoreRuntimeStates((currentStates) =>
        deleteLoreRuntimeStateForOwner(currentStates, "roleplay-thread", threadId),
      );
    },
    [setLoreRuntimeStates, setRoleplayThreads],
  );

  const deleteRoleplayThread = useCallback(
    (threadId: string) => {
      setRoleplayThreads((currentThreads) => deleteRoleplayThreadRecord(currentThreads, threadId));
      setLoreRuntimeStates((currentStates) =>
        deleteLoreRuntimeStateForOwner(currentStates, "roleplay-thread", threadId),
      );
      setRippleStates((currentStates) =>
        deleteRippleStateForOwner(currentStates, "roleplay-thread", threadId),
      );

      if (view.kind === "roleplay" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [setLoreRuntimeStates, setRoleplayThreads, setRippleStates, setView, view],
  );

  return {
    createRoleplayThread,
    updateRoleplayThread,
    renameRoleplayThread,
    clearRoleplayThreadEntries,
    deleteRoleplayThread,
  };
}
