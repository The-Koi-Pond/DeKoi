import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/character";
import type { LorebookRecord } from "../../../engine/lorebook";
import type { MessengerThread } from "../../../engine/messenger";
import {
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  deleteMessengerThread as deleteMessengerThreadRecord,
  renameMessengerThread as renameMessengerThreadRecord,
} from "../../../engine/messenger-actions";
import type { PersonaRecord } from "../../../engine/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseMessengerThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  characters: CharacterRecord[];
  lorebooks: LorebookRecord[];
  messengerThreads: MessengerThread[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setMessengerThreads: StateSetter<MessengerThread[]>;
  setView: (view: PondView) => void;
  view: PondView;
  openMessengerThread: (threadId: string) => void;
};

export function useMessengerThreadActions({
  activeMessengerConnectionId,
  characters,
  lorebooks,
  messengerThreads,
  personas,
  providerConnections,
  setMessengerThreads,
  setView,
  view,
  openMessengerThread,
}: UseMessengerThreadActionsInput) {
  const createMessengerThread = useCallback(() => {
    const now = currentIsoTimestamp();
    const activePersona = personas[0] ?? null;
    const activeConnection =
      providerConnections.find(
        (connection) => connection.id === activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildMessengerThread({
      activePersonaId: activePersona?.id ?? null,
      characterIds: characters.map((companion) => companion.id),
      id: createRecordId("messenger-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Messenger ${messengerThreads.length + 1}`,
    });

    setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
    openMessengerThread(thread.id);
    return thread;
  }, [
    activeMessengerConnectionId,
    characters,
    lorebooks,
    messengerThreads.length,
    openMessengerThread,
    personas,
    providerConnections,
    setMessengerThreads,
  ]);

  const updateMessengerThread = useCallback(
    (thread: MessengerThread) => {
      setMessengerThreads((currentThreads) =>
        currentThreads.some((currentThread) => currentThread.id === thread.id)
          ? currentThreads.map((currentThread) =>
              currentThread.id === thread.id ? thread : currentThread,
            )
          : [thread, ...currentThreads],
      );
    },
    [setMessengerThreads],
  );

  const renameMessengerThread = useCallback(
    (threadId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const now = currentIsoTimestamp();
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId
            ? renameMessengerThreadRecord(thread, trimmedTitle, now)
            : thread,
        ),
      );
    },
    [setMessengerThreads],
  );

  const clearMessengerThreadMessages = useCallback(
    (threadId: string) => {
      const now = currentIsoTimestamp();
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId
            ? clearMessengerMessages(thread, now)
            : thread,
        ),
      );
    },
    [setMessengerThreads],
  );

  const deleteMessengerThread = useCallback(
    (threadId: string) => {
      setMessengerThreads((currentThreads) =>
        deleteMessengerThreadRecord(currentThreads, threadId),
      );

      if (view.kind === "messenger" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [setMessengerThreads, setView, view],
  );

  return {
    createMessengerThread,
    updateMessengerThread,
    renameMessengerThread,
    clearMessengerThreadMessages,
    deleteMessengerThread,
  };
}
