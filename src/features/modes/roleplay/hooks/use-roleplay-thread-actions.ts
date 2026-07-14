import { useCallback, useEffect, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type {
  ModeMessage,
  ModeThread,
  RoleplayModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import {
  appendRoleplayMessages,
  clearRoleplayMessages,
  createRoleplayThread as buildRoleplayThread,
  renameRoleplayThread as renameRoleplayThreadRecord,
  setRoleplayThreadPresetChoiceSelections,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { resolvePromptPresetChoiceControls } from "../../../../engine/prompt-presets/prompt-preset-actions";
import { deleteLoreRuntimeStateForOwner } from "../../../../engine/lore-runtime/lore-runtime-actions";
import { deleteMacroVariableStateForOwner } from "../../../../engine/macro-variables/macro-variable-actions";
import { deleteRippleStateForOwner } from "../../../../engine/ripples/ripple-actions";
import { currentIsoTimestamp } from "../../../../shared/browser/current-time";
import { createRecordId } from "../../../../shared/browser/record-id";
import { cleanTextArray } from "../../../../shared/text";
import type { RoleplayThreadCreateInput, PondView } from "../../../navigation";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { projectPresetChoiceState } from "../../shared/prompt-preset-choice-state";

type UseRoleplayThreadActionsInput = {
  activeMessengerConnectionId: ProviderConnectionId;
  defaultPromptPresetId?: string | null;
  promptPresets: readonly PromptPresetRecord[];
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
  openRoleplayThread: (threadId: string) => void;
};

export function useRoleplayThreadActions({
  activeMessengerConnectionId,
  defaultPromptPresetId = null,
  promptPresets,
  characters,
  modeThreads,
  personas,
  providerConnections,
  setModeThreads,
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
      const characterIds = cleanTextArray(
        input?.characterIds ?? characters.slice(0, 1).map((character) => character.id),
      );
      const openingCharacter =
        characterIds
          .map((id) => characters.find((character) => character.id === id) ?? null)
          .find((character) => !!character?.firstMessage.trim()) ?? null;
      const activeConnection =
        providerConnections.find((connection) =>
          input?.providerConnectionId
            ? connection.id === input.providerConnectionId
            : connection.id === activeMessengerConnectionId,
        ) ??
        providerConnections[0] ??
        null;
      let thread = buildRoleplayThread({
        activePersonaId:
          input?.activePersonaId === undefined
            ? (personas[0]?.id ?? null)
            : input.activePersonaId?.trim() || null,
        characterIds,
        id: createRecordId("roleplay-thread"),
        branchId: createRecordId("roleplay-branch"),
        lorebookIds: cleanTextArray(input?.lorebookIds),
        now,
        defaultPromptPresetId,
        providerConnectionId: activeConnection?.id ?? null,
        title:
          input?.title?.trim() ||
          `New Roleplay ${modeThreads.filter((item) => item.kind === "roleplay").length + 1}`,
        openingCharacter: openingCharacter
          ? { id: openingCharacter.id, displayName: openingCharacter.displayName }
          : null,
        greetingText: openingCharacter?.firstMessage,
        greetingMessageId: openingCharacter ? createRecordId("roleplay-message") : undefined,
        greetingVersionId: openingCharacter ? createRecordId("roleplay-version") : undefined,
      });
      const defaultPreset = defaultPromptPresetId
        ? promptPresets.find((preset) => preset.id === defaultPromptPresetId)
        : null;
      const defaultPresetHasChoices = defaultPreset
        ? resolvePromptPresetChoiceControls({ preset: defaultPreset, selections: {} }).length > 0
        : false;
      if (defaultPreset && !defaultPresetHasChoices) {
        thread = setRoleplayThreadPresetChoiceSelections(thread, {}, now);
      }
      setModeThreads((threads) => [thread, ...threads]);
      openRoleplayThread(thread.id);
      if (defaultPresetHasChoices) openChatSettings();
      return thread;
    },
    [
      activeMessengerConnectionId,
      characters,
      defaultPromptPresetId,
      modeThreads,
      openChatSettings,
      openRoleplayThread,
      personas,
      providerConnections,
      promptPresets,
      setModeThreads,
    ],
  );
  const [promptPresetRepairNotices, setPromptPresetRepairNotices] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    const repairs = modeThreads.flatMap((thread) => {
      if (thread.kind !== "roleplay") return [];
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
        if (thread.kind !== "roleplay") return thread;
        const repair = repairs.find((candidate) => candidate.threadId === thread.id);
        if (!repair) return thread;
        const branch = getActiveModeBranch(thread);
        const preset = branch.presetId
          ? promptPresets.find((candidate) => candidate.id === branch.presetId)
          : null;
        const latest = projectPresetChoiceState(preset, branch.presetChoiceSelectionsByPresetId);
        return latest.repairReason === "invalid-history"
          ? setRoleplayThreadPresetChoiceSelections(thread, repair.selections, repairedAt)
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
  const updateRoleplayThread = useCallback(
    (thread: RoleplayModeThread) =>
      setModeThreads((threads) =>
        threads.map((current) =>
          current.kind === "roleplay" && current.id === thread.id ? thread : current,
        ),
      ),
    [setModeThreads],
  );
  const updateRoleplayThreadById = useCallback(
    (threadId: string, updater: (thread: RoleplayModeThread) => RoleplayModeThread) => {
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "roleplay" && thread.id === threadId ? updater(thread) : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const appendRoleplayThreadEntries = useCallback(
    (threadId: string, entries: ModeMessage[]) => {
      if (!entries.length) return;
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "roleplay" && thread.id === threadId
            ? appendRoleplayMessages(thread, entries)
            : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const renameRoleplayThread = useCallback(
    (threadId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const now = currentIsoTimestamp();
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "roleplay" && thread.id === threadId
            ? renameRoleplayThreadRecord(thread, trimmed, now)
            : thread,
        ),
      );
    },
    [setModeThreads],
  );
  const clearRoleplayThreadEntries = useCallback(
    (threadId: string) => {
      const branchId = modeThreads.find(
        (thread): thread is RoleplayModeThread =>
          thread.kind === "roleplay" && thread.id === threadId,
      )?.activeBranchId;
      setModeThreads((threads) =>
        threads.map((thread) =>
          thread.kind === "roleplay" && thread.id === threadId
            ? clearRoleplayMessages(thread)
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
  const deleteRoleplayThread = useCallback(
    (threadId: string) => {
      const target = modeThreads.find(
        (thread): thread is RoleplayModeThread =>
          thread.kind === "roleplay" && thread.id === threadId,
      );
      const branchIds = target?.branches.map((branch) => branch.id) ?? [];
      setModeThreads((threads) =>
        threads.filter((thread) => !(thread.kind === "roleplay" && thread.id === threadId)),
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
      if (view.kind === "roleplay" && view.threadId === threadId) setView({ kind: "pond" });
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
