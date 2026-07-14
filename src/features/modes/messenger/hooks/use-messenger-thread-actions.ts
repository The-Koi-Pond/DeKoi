import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import { resolvePromptPresetChoiceControls } from "../../../../engine/prompt-presets/prompt-preset-actions";
import {
  appendMessengerMessages,
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  deleteMessengerThread as deleteMessengerThreadRecord,
  renameMessengerThread as renameMessengerThreadRecord,
} from "../../../../engine/modes/messenger/messenger-actions";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import { currentIsoTimestamp } from "../../../../shared/browser/current-time";
import { createRecordId } from "../../../../shared/browser/record-id";
import { cleanTextArray } from "../../../../shared/text";
import type { MessengerThreadCreateInput, PondView } from "../../../navigation";
import { deleteMacroVariableStateForOwner } from "../../../../engine/macro-variables/macro-variable-actions";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { deleteLoreRuntimeStateForOwner } from "../../../../engine/lore-runtime/lore-runtime-actions";
import { setMessengerThreadPresetChoiceSelections } from "../../../../engine/modes/messenger/messenger-actions";
import { projectPresetChoiceState } from "../../shared/prompt-preset-choice-state";

type UseMessengerThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  defaultPromptPresetId?: string | null;
  promptPresets?: readonly PromptPresetRecord[];
  characters: CharacterRecord[];
  messengerThreads: MessengerThread[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setMessengerThreads: StateSetter<MessengerThread[]>;
  setLoreRuntimeStates: StateSetter<LoreRuntimeState[]>;
  setMacroVariableStates: StateSetter<MacroVariableScope[]>;
  setView: (view: PondView) => void;
  view: PondView;
  openChatSettings: () => void;
  openMessengerThread: (threadId: string) => void;
};

export function useMessengerThreadActions({
  activeMessengerConnectionId,
  defaultPromptPresetId = null,
  promptPresets = [],
  characters,
  messengerThreads,
  providerConnections,
  setMessengerThreads,
  setLoreRuntimeStates,
  setMacroVariableStates,
  setView,
  view,
  openChatSettings,
  openMessengerThread,
}: UseMessengerThreadActionsInput) {
  const createMessengerThread = useCallback(
    (input?: MessengerThreadCreateInput) => {
      const now = currentIsoTimestamp();
      const activePersonaId = input?.activePersonaId?.trim() || null;
      const fallbackCharacterIds = characters[0] ? [characters[0].id] : [];
      const cleanCharacterIds = cleanTextArray(input?.characterIds ?? fallbackCharacterIds);
      const cleanLorebookIds = cleanTextArray(input?.lorebookIds);
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
        defaultPromptPresetId,
        providerConnectionId: activeConnection?.id ?? null,
        title: input?.title?.trim() || fallbackTitle,
      });
      const defaultPreset = defaultPromptPresetId
        ? promptPresets.find((preset) => preset.id === defaultPromptPresetId)
        : null;
      const defaultPresetHasChoices = defaultPreset
        ? resolvePromptPresetChoiceControls({ preset: defaultPreset, selections: {} }).length > 0
        : false;
      if (defaultPreset && !defaultPresetHasChoices) {
        thread.presetChoiceSelectionsByPresetId = { [defaultPreset.id]: {} };
      }

      setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
      openMessengerThread(thread.id);
      if (defaultPresetHasChoices) openChatSettings();
      return thread;
    },
    [
      activeMessengerConnectionId,
      defaultPromptPresetId,
      promptPresets,
      characters,
      messengerThreads.length,
      openChatSettings,
      openMessengerThread,
      providerConnections,
      setMessengerThreads,
    ],
  );

  const [promptPresetRepairNotices, setPromptPresetRepairNotices] = useState<
    Record<string, string>
  >({});
  const repairedPresetKeys = useRef(new Set<string>());
  const pendingRepairs = useRef(
    new Map<
      string,
      { threadId: string; presetId: string; sourceFingerprint: string; repairedFingerprint: string }
    >(),
  );
  const noticePresetIds = useRef(new Map<string, string>());
  useEffect(() => {
    messengerThreads.forEach((thread) => {
      if (!thread.presetId) return;
      const preset = promptPresets.find((candidate) => candidate.id === thread.presetId);
      const projection = projectPresetChoiceState(preset, thread.presetChoiceSelectionsByPresetId);
      if (!preset || projection.repairReason !== "invalid-history") return;
      const key = `${thread.id}:${preset.id}:${projection.fingerprint}`;
      if (repairedPresetKeys.current.has(key) || pendingRepairs.current.has(key)) return;
      const repairedAt = currentIsoTimestamp();
      const repaired = setMessengerThreadPresetChoiceSelections(
        thread,
        projection.materializedSelections,
        repairedAt,
      );
      pendingRepairs.current.set(key, {
        threadId: thread.id,
        presetId: preset.id,
        sourceFingerprint: projection.fingerprint,
        repairedFingerprint: JSON.stringify(
          repaired.presetChoiceSelectionsByPresetId?.[preset.id] ?? {},
        ),
      });
      setMessengerThreads((currentThreads) =>
        currentThreads.map((currentThread) => {
          if (currentThread.id !== thread.id || currentThread.presetId !== preset.id)
            return currentThread;
          const latest = projectPresetChoiceState(
            preset,
            currentThread.presetChoiceSelectionsByPresetId,
          );
          if (
            latest.fingerprint !== projection.fingerprint ||
            latest.repairReason !== "invalid-history"
          )
            return currentThread;
          return setMessengerThreadPresetChoiceSelections(
            currentThread,
            latest.materializedSelections,
            repairedAt,
          );
        }),
      );
    });
  }, [messengerThreads, promptPresets, setMessengerThreads]);
  useEffect(() => {
    let changed = false;
    const next = { ...promptPresetRepairNotices };
    for (const [key, pending] of pendingRepairs.current) {
      const thread = messengerThreads.find((candidate) => candidate.id === pending.threadId);
      const projection =
        thread?.presetId === pending.presetId
          ? projectPresetChoiceState(
              promptPresets.find((candidate) => candidate.id === pending.presetId),
              thread.presetChoiceSelectionsByPresetId,
            )
          : null;
      if (!thread || !projection) {
        pendingRepairs.current.delete(key);
        continue;
      }
      if (
        projection.fingerprint === pending.sourceFingerprint &&
        projection.repairReason === "invalid-history"
      )
        continue;
      if (projection.fingerprint !== pending.repairedFingerprint) {
        pendingRepairs.current.delete(key);
        continue;
      }
      repairedPresetKeys.current.add(key);
      pendingRepairs.current.delete(key);
      next[pending.threadId] = "Prompt preset choices were repaired.";
      noticePresetIds.current.set(pending.threadId, pending.presetId);
      changed = true;
    }
    for (const [threadId, presetId] of noticePresetIds.current) {
      if (messengerThreads.find((thread) => thread.id === threadId)?.presetId !== presetId) {
        noticePresetIds.current.delete(threadId);
        delete next[threadId];
        changed = true;
      }
    }
    if (changed) queueMicrotask(() => setPromptPresetRepairNotices(next));
  }, [messengerThreads, promptPresets, promptPresetRepairNotices]);

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

  const updateMessengerThreadById = useCallback(
    (threadId: string, updater: (thread: MessengerThread) => MessengerThread) => {
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) => (thread.id === threadId ? updater(thread) : thread)),
      );
    },
    [setMessengerThreads],
  );

  const appendMessengerThreadMessages = useCallback(
    (threadId: string, messages: MessengerThread["messages"]) => {
      if (messages.length === 0) return;

      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? appendMessengerMessages(thread, messages) : thread,
        ),
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
          thread.id === threadId ? renameMessengerThreadRecord(thread, trimmedTitle, now) : thread,
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
      setLoreRuntimeStates((currentStates) =>
        deleteLoreRuntimeStateForOwner(currentStates, "messenger-thread", threadId),
      );
      setMacroVariableStates((currentStates) =>
        deleteMacroVariableStateForOwner(currentStates, "messenger-thread", threadId),
      );
    },
    [setLoreRuntimeStates, setMacroVariableStates, setMessengerThreads],
  );

  const deleteMessengerThread = useCallback(
    (threadId: string) => {
      setMessengerThreads((currentThreads) =>
        deleteMessengerThreadRecord(currentThreads, threadId),
      );
      setLoreRuntimeStates((currentStates) =>
        deleteLoreRuntimeStateForOwner(currentStates, "messenger-thread", threadId),
      );
      setMacroVariableStates((currentStates) =>
        deleteMacroVariableStateForOwner(currentStates, "messenger-thread", threadId),
      );

      if (view.kind === "messenger" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [setLoreRuntimeStates, setMacroVariableStates, setMessengerThreads, setView, view],
  );

  return {
    createMessengerThread,
    updateMessengerThread,
    updateMessengerThreadById,
    appendMessengerThreadMessages,
    renameMessengerThread,
    clearMessengerThreadMessages,
    deleteMessengerThread,
    messengerPromptPresetRepairNotices: promptPresetRepairNotices,
    clearMessengerPromptPresetRepairNotice: (threadId: string) =>
      setPromptPresetRepairNotices((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      }),
  };
}
