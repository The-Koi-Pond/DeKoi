import { useCallback } from "react";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../engine/contracts/types/messenger";
import {
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  deleteMessengerThread as deleteMessengerThreadRecord,
  renameMessengerThread as renameMessengerThreadRecord,
} from "../../../engine/modes/messenger/messenger-actions";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { MessengerThreadCreateInput, PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseMessengerThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  characters: CharacterRecord[];
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
  messengerThreads,
  providerConnections,
  setMessengerThreads,
  setView,
  view,
  openMessengerThread,
}: UseMessengerThreadActionsInput) {
  const createMessengerThread = useCallback((input?: MessengerThreadCreateInput) => {
    const now = currentIsoTimestamp();
    const activePersonaId = input?.activePersonaId?.trim() || null;
    const fallbackCharacterIds = characters[0] ? [characters[0].id] : [];
    const cleanCharacterIds: string[] = [...new Set<string>(
      (input?.characterIds ?? fallbackCharacterIds)
        .map((id) => id.trim())
        .filter(Boolean),
    )];
    const cleanLorebookIds: string[] = [...new Set<string>(
      (input?.lorebookIds ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    )];
    const activeConnection =
      providerConnections.find((connection) =>
        input?.providerConnectionId
          ? connection.id === input.providerConnectionId
          : connection.id === activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const fallbackTitle =
      characters
        .filter((companion) => cleanCharacterIds.includes(companion.id))
        .map((companion) => companion.displayName)
        .join(" + ") || `New Messenger ${messengerThreads.length + 1}`;
    const thread = buildMessengerThread({
      activePersonaId,
      characterIds: cleanCharacterIds,
      id: createRecordId("messenger-thread"),
      lorebookIds: cleanLorebookIds,
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: input?.title?.trim() || fallbackTitle,
    });

    setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
    openMessengerThread(thread.id);
    return thread;
  }, [
    activeMessengerConnectionId,
    characters,
    messengerThreads.length,
    openMessengerThread,
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
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? clearMessengerMessages(thread) : thread,
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
