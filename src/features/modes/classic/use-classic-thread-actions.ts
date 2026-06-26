import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/character";
import type { ClassicThread } from "../../../engine/classic";
import {
  appendClassicEntries,
  clearClassicEntries,
  createCompanionClassicEntry,
  createClassicThread as buildClassicThread,
  deleteClassicThread as deleteClassicThreadRecord,
  renameClassicThread as renameClassicThreadRecord,
} from "../../../engine/classic-actions";
import type { LorebookRecord } from "../../../engine/lorebook";
import type { PersonaRecord } from "../../../engine/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import type { RippleState } from "../../../engine/ripples";
import { deleteRippleStateForOwner } from "../../../engine/ripple-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { ClassicThreadCreateInput, PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseClassicThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  characters: CharacterRecord[];
  classicThreads: ClassicThread[];
  lorebooks: LorebookRecord[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setClassicThreads: StateSetter<ClassicThread[]>;
  setRippleStates: StateSetter<RippleState[]>;
  setView: (view: PondView) => void;
  view: PondView;
  openClassicThread: (threadId: string) => void;
};

export function useClassicThreadActions({
  activeMessengerConnectionId,
  characters,
  classicThreads,
  lorebooks,
  personas,
  providerConnections,
  setClassicThreads,
  setRippleStates,
  setView,
  view,
  openClassicThread,
}: UseClassicThreadActionsInput) {
  const createClassicThread = useCallback((input?: ClassicThreadCreateInput) => {
    const now = currentIsoTimestamp();
    const activePersonaId =
      input?.activePersonaId === undefined
        ? personas[0]?.id ?? null
        : input.activePersonaId?.trim() || null;
    const characterIds = [
      ...new Set(
        (input?.characterIds ??
          characters.slice(0, 1).map((companion) => companion.id))
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const lorebookIds = [
      ...new Set(
        (input?.lorebookIds ?? lorebooks.map((lorebook) => lorebook.id))
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const requestedConnectionId = input?.providerConnectionId?.trim() ?? "";
    const activeConnection =
      providerConnections.find(
        (connection) =>
          requestedConnectionId
            ? connection.id === requestedConnectionId
            : connection.id === activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildClassicThread({
      activePersonaId,
      characterIds,
      id: createRecordId("classic-thread"),
      lorebookIds,
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: input?.title?.trim() || `New Classic ${classicThreads.length + 1}`,
    });
    const openingCompanion =
      characterIds
        .map(
          (characterId) =>
            characters.find((character) => character.id === characterId) ?? null,
        )
        .find((character) => !!character?.firstMessage.trim()) ?? null;
    const threadWithOpeningEntry = openingCompanion
      ? appendClassicEntries(
          thread,
          [
            createCompanionClassicEntry({
              body: openingCompanion.firstMessage,
              companion: openingCompanion,
              id: createRecordId("classic-entry"),
              now,
              thread,
            }),
          ],
          now,
        )
      : thread;

    setClassicThreads((currentThreads) => [threadWithOpeningEntry, ...currentThreads]);
    openClassicThread(threadWithOpeningEntry.id);
    return threadWithOpeningEntry;
  }, [
    activeMessengerConnectionId,
    characters,
    classicThreads.length,
    lorebooks,
    openClassicThread,
    personas,
    providerConnections,
    setClassicThreads,
  ]);

  const updateClassicThread = useCallback(
    (thread: ClassicThread) => {
      setClassicThreads((currentThreads) =>
        currentThreads.some((currentThread) => currentThread.id === thread.id)
          ? currentThreads.map((currentThread) =>
              currentThread.id === thread.id ? thread : currentThread,
            )
          : [thread, ...currentThreads],
      );
    },
    [setClassicThreads],
  );

  const renameClassicThread = useCallback(
    (threadId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const now = currentIsoTimestamp();
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId
            ? renameClassicThreadRecord(thread, trimmedTitle, now)
            : thread,
        ),
      );
    },
    [setClassicThreads],
  );

  const clearClassicThreadEntries = useCallback(
    (threadId: string) => {
      const now = currentIsoTimestamp();
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? clearClassicEntries(thread, now) : thread,
        ),
      );
    },
    [setClassicThreads],
  );

  const deleteClassicThread = useCallback(
    (threadId: string) => {
      setClassicThreads((currentThreads) =>
        deleteClassicThreadRecord(currentThreads, threadId),
      );
      setRippleStates((currentStates) =>
        deleteRippleStateForOwner(currentStates, "classic-thread", threadId),
      );

      if (view.kind === "classic" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [setClassicThreads, setRippleStates, setView, view],
  );

  return {
    createClassicThread,
    updateClassicThread,
    renameClassicThread,
    clearClassicThreadEntries,
    deleteClassicThread,
  };
}
