import {
  setRoleplayThreadLorebooks,
  setRoleplayThreadParticipants,
  setRoleplayThreadPersona,
  setRoleplayThreadPreset,
  setRoleplayThreadPresetChoiceSelections,
  setRoleplayThreadProviderConnection,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type { PromptPresetThreadChoiceSelections } from "../../../../engine/contracts/types/prompt-presets";
import type {
  ChatSettingsIdentityActions,
  ChatSettingsThreadPresetActions,
  ChatSettingsThreadResourceActions,
} from "../lib/chat-settings-controller-groups";
import { toggleSelectedId } from "../lib/toggle-selected-id";
import type { ShoalNav } from "../types";

interface UseChatSettingsRoleplayActionsInput {
  activeRoleplayThread: RoleplayThread | null;
  characters: ShoalNav["characters"];
  lorebooks: ShoalNav["lorebooks"];
  onCompanionSelectorOpenChange: (open: boolean) => void;
  onUpdateRoleplayThreadById: ShoalNav["updateRoleplayThreadById"];
}

export function transformRoleplayPresetConfirm(
  thread: RoleplayThread,
  presetId: string,
  selections: PromptPresetThreadChoiceSelections,
  updatedAt: string,
): RoleplayThread {
  return setRoleplayThreadPreset(thread, presetId.trim() || null, updatedAt, selections);
}

export function useChatSettingsRoleplayActions({
  activeRoleplayThread,
  characters,
  lorebooks,
  onCompanionSelectorOpenChange,
  onUpdateRoleplayThreadById,
}: UseChatSettingsRoleplayActionsInput) {
  function updateActiveRoleplayThread(
    updater: (thread: RoleplayThread, updatedAt: string) => RoleplayThread,
  ) {
    if (!activeRoleplayThread) return;
    onUpdateRoleplayThreadById(activeRoleplayThread.id, (thread) =>
      updater(thread, new Date().toISOString()),
    );
  }

  function handleRoleplayConnectionChange(connectionId: string) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadProviderConnection(thread, connectionId.trim() || null, updatedAt),
    );
  }

  function handleRoleplayPersonaChange(personaId: string) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadPersona(thread, personaId.trim() || null, updatedAt),
    );
  }

  function toggleRoleplayCompanion(characterId: string) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadParticipants(
        thread,
        toggleSelectedId(thread.characterIds, characterId),
        updatedAt,
      ),
    );
  }

  function toggleRoleplayLorebook(lorebookId: string) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadLorebooks(
        thread,
        toggleSelectedId(thread.lorebookIds, lorebookId),
        updatedAt,
      ),
    );
  }

  function handleRoleplayPresetChange(presetId: string) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadPreset(thread, presetId.trim() || null, updatedAt),
    );
  }

  function handleRoleplayPresetConfirm(
    presetId: string,
    selections: PromptPresetThreadChoiceSelections,
  ) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      transformRoleplayPresetConfirm(thread, presetId, selections, updatedAt),
    );
  }

  function handleRoleplayPresetChoiceChange(selections: PromptPresetThreadChoiceSelections) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadPresetChoiceSelections(thread, selections, updatedAt),
    );
  }

  function clearMissingRoleplayPreset() {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadPreset(thread, null, updatedAt),
    );
  }

  function resolveMissingRoleplayConnection(connectionId: string | null) {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadProviderConnection(thread, connectionId, updatedAt),
    );
  }

  function clearMissingRoleplayCompanions() {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadParticipants(
        thread,
        thread.characterIds.filter((characterId) =>
          characters.some((character) => character.id === characterId),
        ),
        updatedAt,
      ),
    );
    onCompanionSelectorOpenChange(false);
  }

  function clearMissingRoleplayLorebooks() {
    updateActiveRoleplayThread((thread, updatedAt) =>
      setRoleplayThreadLorebooks(
        thread,
        thread.lorebookIds.filter((lorebookId) =>
          lorebooks.some((lorebook) => lorebook.id === lorebookId),
        ),
        updatedAt,
      ),
    );
  }

  const identityActions: ChatSettingsIdentityActions = {
    onConnectionChange: handleRoleplayConnectionChange,
    onPersonaChange: handleRoleplayPersonaChange,
    onResolveMissingConnection: resolveMissingRoleplayConnection,
  };
  const presetActions: ChatSettingsThreadPresetActions = {
    onClearMissingPreset: clearMissingRoleplayPreset,
    onPresetChoiceChange: handleRoleplayPresetChoiceChange,
    onPresetChange: handleRoleplayPresetChange,
    onPresetConfirm: handleRoleplayPresetConfirm,
  };
  const resourceActions: ChatSettingsThreadResourceActions = {
    clearMissingCompanions: clearMissingRoleplayCompanions,
    clearMissingLorebooks: clearMissingRoleplayLorebooks,
    onToggleCompanion: toggleRoleplayCompanion,
    onToggleLorebook: toggleRoleplayLorebook,
  };

  return {
    identityActions,
    presetActions,
    resourceActions,
  };
}
