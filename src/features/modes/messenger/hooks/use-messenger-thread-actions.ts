import { useCallback, useEffect, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type {
  MessengerModeThread,
  ModeMessage,
  ModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import {
  appendMessengerMessages,
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  renameMessengerThread as renameMessengerThreadRecord,
  setMessengerThreadPresetChoiceSelections,
} from "../../../../engine/modes/messenger/messenger-actions";
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { resolvePromptPresetChoiceControls } from "../../../../engine/prompt-presets/prompt-preset-actions";
import { deleteLoreRuntimeStateForOwner } from "../../../../engine/lore-runtime/lore-runtime-actions";
import { deleteMacroVariableStateForOwner } from "../../../../engine/macro-variables/macro-variable-actions";
import { deleteRippleStateForOwner } from "../../../../engine/ripples/ripple-actions";
import { currentIsoTimestamp } from "../../../../shared/browser/current-time";
import { createRecordId } from "../../../../shared/browser/record-id";
import { cleanTextArray } from "../../../../shared/text";
import type { MessengerThreadCreateInput, PondView } from "../../../navigation";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { projectPresetChoiceState } from "../../shared/prompt-preset-choice-state";

type UseMessengerThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  defaultPromptPresetId?: string | null;
  promptPresets?: readonly PromptPresetRecord[];
  characters: CharacterRecord[];
  modeThreads: ModeThread[];
  personas: PersonaRecord[];
  providerConnections: ProviderConnectionRecord[];
  setModeThreads: StateSetter<ModeThread[]>;
  setLoreRuntimeStates: StateSetter<LoreRuntimeState[]>;
  setMacroVariableStates: StateSetter<MacroVariableScope[]>;
  setRippleStates: StateSetter<RippleState[]>;
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
  modeThreads,
  providerConnections,
  setModeThreads,
  setLoreRuntimeStates,
  setMacroVariableStates,
  setRippleStates,
  setView,
  view,
  openChatSettings,
  openMessengerThread,
}: UseMessengerThreadActionsInput) {
  const createMessengerThread = useCallback(
    (input?: MessengerThreadCreateInput) => {
      const now = currentIsoTimestamp();
      const characterIds = cleanTextArray(
        input?.characterIds ?? (characters[0] ? [characters[0].id] : []),
      );
      const activeConnection =
        providerConnections.find((connection) =>
          input?.providerConnectionId
            ? connection.id === input.providerConnectionId
            : connection.id === activeMessengerConnectionId,
        ) ??
        providerConnections[0] ??
        null;
      const title =
        input?.title?.trim() ||
        characters
          .filter((character) => characterIds.includes(character.id))
          .map((character) => character.displayName)
          .join(" + ") ||
        `New Messenger ${modeThreads.filter((thread) => thread.kind === "messenger").length + 1}`;
      let thread = buildMessengerThread({
        activePersonaId: input?.activePersonaId?.trim() || null,
        characterIds,
        id: createRecordId("messenger-thread"),
        branchId: createRecordId("messenger-branch"),
        lorebookIds: cleanTextArray(input?.lorebookIds),
        now,
        defaultPromptPresetId,
        providerConnectionId: activeConnection?.id ?? null,
        title,
      });
      const defaultPreset = defaultPromptPresetId
        ? promptPresets.find((preset) => preset.id === defaultPromptPresetId)
        : null;
      const defaultPresetHasChoices = defaultPreset
        ? resolvePromptPresetChoiceControls({ preset: defaultPreset, selections: {} }).length > 0
        : false;
      if (defaultPreset && !defaultPresetHasChoices) {
        thread = setMessengerThreadPresetChoiceSelections(thread, {}, now);
      }
      setModeThreads((threads) => [thread, ...threads]);
      openMessengerThread(thread.id);
      if (defaultPresetHasChoices) openChatSettings();
      return thread;
    },
    [
      activeMessengerConnectionId,
      characters,
      defaultPromptPresetId,
      modeThreads,
      openChatSettings,
      openMessengerThread,
      promptPresets,
      providerConnections,
      setModeThreads,
    ],
  );

  const [promptPresetRepairNotices, setPromptPresetRepairNotices] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    const repairs = modeThreads.flatMap((thread) => {
      if (thread.kind !== "messenger") return [];
      const branch = getActiveModeBranch(thread);
      if (!branch.presetId) return [];
      const preset = promptPresets.find((candidate) => candidate.id === branch.presetId);
      const projection = projectPresetChoiceState(preset, branch.presetChoiceSelectionsByPresetId);
      return preset && projection.repairReason === "invalid-history"
        ? [{ threadId: thread.id, selections: projection.materializedSelections }]
        : [];
    });
    if (!repairs.length) return;
    const repairedAt = currentIsoTimestamp();
    setModeThreads((threads) =>
      threads.map((thread) => {
        if (thread.kind !== "messenger") return thread;
        const repair = repairs.find((candidate) => candidate.threadId === thread.id);
        if (!repair) return thread;
        const branch = getActiveModeBranch(thread);
        const preset = branch.presetId
          ? promptPresets.find((candidate) => candidate.id === branch.presetId)
          : null;
        const latest = projectPresetChoiceState(preset, branch.presetChoiceSelectionsByPresetId);
        return latest.repairReason === "invalid-history"
          ? setMessengerThreadPresetChoiceSelections(thread, repair.selections, repairedAt)
          : thread;
      }),
    );
    // This notice is a direct consequence of the repair performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPromptPresetRepairNotices((current) => ({
      ...current,
      ...Object.fromEntries(
        repairs.map(({ threadId }) => [threadId, "Prompt preset choices were repaired."]),
      ),
    }));
  }, [modeThreads, promptPresets, setModeThreads]);

  const updateMessengerThread = useCallback(
    (thread: MessengerModeThread) => {
      setModeThreads((threads) =>
        threads.map((current) =>
          current.kind === "messenger" && current.id === thread.id ? thread : current,
        ),
      );
    },
    [setModeThreads],
  );
  const updateMessengerThreadById = useCallback(
    (threadId: string, updater: (thread: MessengerModeThread) => MessengerModeThread) => {
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "messenger" && thread.id === threadId ? updater(thread) : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const appendMessengerThreadMessages = useCallback(
    (threadId: string, messages: ModeMessage[]) => {
      if (!messages.length) return;
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "messenger" && thread.id === threadId
            ? appendMessengerMessages(thread, messages)
            : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const renameMessengerThread = useCallback(
    (threadId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const now = currentIsoTimestamp();
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "messenger" && thread.id === threadId
            ? renameMessengerThreadRecord(thread, trimmed, now)
            : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const clearMessengerThreadMessages = useCallback(
    (threadId: string) => {
      const branchId = modeThreads.find(
        (thread): thread is MessengerModeThread =>
          thread.kind === "messenger" && thread.id === threadId,
      )?.activeBranchId;
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "messenger" && thread.id === threadId
            ? clearMessengerMessages(thread)
            : thread,
        ),
      );
      if (!branchId) return;
      setLoreRuntimeStates((states) =>
        deleteLoreRuntimeStateForOwner(states, "mode-branch", branchId),
      );
      setMacroVariableStates((states) =>
        deleteMacroVariableStateForOwner(states, "mode-branch", branchId),
      );
      setRippleStates((states) => deleteRippleStateForOwner(states, "mode-branch", branchId));
    },
    [modeThreads, setLoreRuntimeStates, setMacroVariableStates, setModeThreads, setRippleStates],
  );
  const deleteMessengerThread = useCallback(
    (threadId: string) => {
      const target = modeThreads.find(
        (thread): thread is MessengerModeThread =>
          thread.kind === "messenger" && thread.id === threadId,
      );
      const branchIds = target?.branches.map((branch) => branch.id) ?? [];
      setModeThreads((threads) =>
        threads.filter((thread) => !(thread.kind === "messenger" && thread.id === threadId)),
      );
      for (const branchId of branchIds) {
        setLoreRuntimeStates((states) =>
          deleteLoreRuntimeStateForOwner(states, "mode-branch", branchId),
        );
        setMacroVariableStates((states) =>
          deleteMacroVariableStateForOwner(states, "mode-branch", branchId),
        );
        setRippleStates((states) => deleteRippleStateForOwner(states, "mode-branch", branchId));
      }
      if (view.kind === "messenger" && view.threadId === threadId) setView({ kind: "pond" });
    },
    [
      modeThreads,
      setLoreRuntimeStates,
      setMacroVariableStates,
      setModeThreads,
      setRippleStates,
      setView,
      view,
    ],
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
