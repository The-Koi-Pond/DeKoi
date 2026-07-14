import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import { resolvePromptPresetChoiceControls } from "../../../../engine/prompt-presets/prompt-preset-actions";
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
import { deleteMacroVariableStateForOwner } from "../../../../engine/macro-variables/macro-variable-actions";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { setRoleplayThreadPresetChoiceSelections } from "../../../../engine/modes/roleplay/roleplay-actions";
import { projectPresetChoiceState } from "../../shared/prompt-preset-choice-state";

type UseRoleplayThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  defaultPromptPresetId?: string | null;
  promptPresets: PromptPresetRecord[];
  characters: CharacterRecord[];
  roleplayThreads: RoleplayThread[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setLoreRuntimeStates: StateSetter<LoreRuntimeState[]>;
  setMacroVariableStates: StateSetter<MacroVariableScope[]>;
  setRippleStates: StateSetter<RippleState[]>;
  setView: (view: PondView) => void;
  view: PondView;
  openChatSettings: () => void;
  openRoleplayThread: (threadId: string) => void;
};

export function useRoleplayThreadActions({
  activeMessengerConnectionId,
  defaultPromptPresetId = null,
  promptPresets,
  characters,
  roleplayThreads,
  personas,
  providerConnections,
  setRoleplayThreads,
  setLoreRuntimeStates,
  setMacroVariableStates,
  setRippleStates,
  setView,
  view,
  openChatSettings,
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
      const defaultPreset = defaultPromptPresetId
        ? (promptPresets.find((preset) => preset.id === defaultPromptPresetId) ?? null)
        : null;
      const defaultPresetHasChoices = defaultPreset
        ? resolvePromptPresetChoiceControls({ preset: defaultPreset, selections: {} }).length > 0
        : false;
      const thread = buildRoleplayThread({
        activePersonaId,
        characterIds,
        id: createRecordId("roleplay-thread"),
        lorebookIds,
        now,
        defaultPromptPresetId,
        providerConnectionId: activeConnection?.id ?? null,
        title: input?.title?.trim() || `New Roleplay ${roleplayThreads.length + 1}`,
      });
      const threadWithPresetHistory =
        defaultPreset && !defaultPresetHasChoices
          ? { ...thread, presetChoiceSelectionsByPresetId: { [defaultPreset.id]: {} } }
          : thread;
      const openingCompanion =
        characterIds
          .map(
            (characterId) => characters.find((character) => character.id === characterId) ?? null,
          )
          .find((character) => !!character?.firstMessage.trim()) ?? null;
      const threadWithOpeningEntry = openingCompanion
        ? appendRoleplayEntries(threadWithPresetHistory, [
            createCompanionRoleplayEntry({
              body: openingCompanion.firstMessage,
              companion: openingCompanion,
              id: createRecordId("roleplay-entry"),
              now,
              thread: threadWithPresetHistory,
            }),
          ])
        : threadWithPresetHistory;

      setRoleplayThreads((currentThreads) => [threadWithOpeningEntry, ...currentThreads]);
      openRoleplayThread(threadWithOpeningEntry.id);
      if (defaultPresetHasChoices) openChatSettings();
      return threadWithOpeningEntry;
    },
    [
      activeMessengerConnectionId,
      defaultPromptPresetId,
      promptPresets,
      characters,
      roleplayThreads.length,
      openChatSettings,
      openRoleplayThread,
      personas,
      providerConnections,
      setRoleplayThreads,
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
    roleplayThreads.forEach((thread) => {
      if (!thread.presetId) return;
      const preset = promptPresets.find((candidate) => candidate.id === thread.presetId);
      const projection = projectPresetChoiceState(preset, thread.presetChoiceSelectionsByPresetId);
      if (!preset || projection.repairReason !== "invalid-history") return;
      const key = `${thread.id}:${preset.id}:${projection.fingerprint}`;
      if (repairedPresetKeys.current.has(key) || pendingRepairs.current.has(key)) return;
      const repairedAt = currentIsoTimestamp();
      const repaired = setRoleplayThreadPresetChoiceSelections(
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
      setRoleplayThreads((currentThreads) =>
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
          return setRoleplayThreadPresetChoiceSelections(
            currentThread,
            latest.materializedSelections,
            repairedAt,
          );
        }),
      );
    });
  }, [roleplayThreads, promptPresets, setRoleplayThreads]);
  useEffect(() => {
    let changed = false;
    const next = { ...promptPresetRepairNotices };
    for (const [key, pending] of pendingRepairs.current) {
      const thread = roleplayThreads.find((candidate) => candidate.id === pending.threadId);
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
      if (
        thread.presetId !== pending.presetId ||
        projection.fingerprint !== pending.repairedFingerprint
      ) {
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
      if (roleplayThreads.find((thread) => thread.id === threadId)?.presetId !== presetId) {
        noticePresetIds.current.delete(threadId);
        delete next[threadId];
        changed = true;
      }
    }
    if (changed) queueMicrotask(() => setPromptPresetRepairNotices(next));
  }, [roleplayThreads, promptPresets, promptPresetRepairNotices]);

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

  const updateRoleplayThreadById = useCallback(
    (threadId: string, updater: (thread: RoleplayThread) => RoleplayThread) => {
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) => (thread.id === threadId ? updater(thread) : thread)),
      );
    },
    [setRoleplayThreads],
  );

  const appendRoleplayThreadEntries = useCallback(
    (threadId: string, entries: RoleplayThread["entries"]) => {
      if (entries.length === 0) return;

      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId ? appendRoleplayEntries(thread, entries) : thread,
        ),
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
      setMacroVariableStates((currentStates) =>
        deleteMacroVariableStateForOwner(currentStates, "roleplay-thread", threadId),
      );
    },
    [setLoreRuntimeStates, setMacroVariableStates, setRoleplayThreads],
  );

  const deleteRoleplayThread = useCallback(
    (threadId: string) => {
      setRoleplayThreads((currentThreads) => deleteRoleplayThreadRecord(currentThreads, threadId));
      setLoreRuntimeStates((currentStates) =>
        deleteLoreRuntimeStateForOwner(currentStates, "roleplay-thread", threadId),
      );
      setMacroVariableStates((currentStates) =>
        deleteMacroVariableStateForOwner(currentStates, "roleplay-thread", threadId),
      );
      setRippleStates((currentStates) =>
        deleteRippleStateForOwner(currentStates, "roleplay-thread", threadId),
      );

      if (view.kind === "roleplay" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [
      setLoreRuntimeStates,
      setMacroVariableStates,
      setRoleplayThreads,
      setRippleStates,
      setView,
      view,
    ],
  );

  return {
    createRoleplayThread,
    updateRoleplayThread,
    updateRoleplayThreadById,
    appendRoleplayThreadEntries,
    renameRoleplayThread,
    clearRoleplayThreadEntries,
    deleteRoleplayThread,
    roleplayPromptPresetRepairNotices: promptPresetRepairNotices,
    clearRoleplayPromptPresetRepairNotice: (threadId: string) =>
      setPromptPresetRepairNotices((current) => {
        const next = { ...current };
        delete next[threadId];
        return next;
      }),
  };
}
