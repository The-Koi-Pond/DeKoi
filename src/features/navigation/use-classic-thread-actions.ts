import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { CharacterRecord } from "../../engine/character";
import type { ClassicThread } from "../../engine/classic";
import {
  clearClassicEntries,
  createClassicThread as buildClassicThread,
  deleteClassicThread as deleteClassicThreadRecord,
  renameClassicThread as renameClassicThreadRecord,
} from "../../engine/classic-actions";
import type { LorebookRecord } from "../../engine/lorebook";
import type { PersonaRecord } from "../../engine/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../engine/provider-connection";
import type { RippleState } from "../../engine/ripples";
import { deleteRippleStateForOwner } from "../../engine/ripple-actions";
import { currentIsoTimestamp } from "../../shared/browser/current-time";
import { createRecordId } from "../../shared/browser/record-id";
import type { PondView } from "./nav-types";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

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
  const createClassicThread = useCallback(() => {
    const now = currentIsoTimestamp();
    const activePersona = personas[0] ?? null;
    const activeConnection =
      providerConnections.find(
        (connection) => connection.id === activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildClassicThread({
      activePersonaId: activePersona?.id ?? null,
      characterIds: characters.slice(0, 1).map((companion) => companion.id),
      id: createRecordId("classic-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Classic ${classicThreads.length + 1}`,
    });

    setClassicThreads((currentThreads) => [thread, ...currentThreads]);
    openClassicThread(thread.id);
    return thread;
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
