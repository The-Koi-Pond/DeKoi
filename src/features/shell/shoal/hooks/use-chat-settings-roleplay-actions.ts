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
  onUpdateRoleplayThread: ShoalNav["updateRoleplayThread"];
}

export function useChatSettingsRoleplayActions({
  activeRoleplayThread,
  characters,
  lorebooks,
  onCompanionSelectorOpenChange,
  onUpdateRoleplayThread,
}: UseChatSettingsRoleplayActionsInput) {
  function updateActiveRoleplayThread(
    updater: (thread: RoleplayThread, updatedAt: string) => RoleplayThread,
  ) {
    if (!activeRoleplayThread) return;
    const updatedThread = updater(activeRoleplayThread, new Date().toISOString());
    if (updatedThread === activeRoleplayThread) return;
    onUpdateRoleplayThread(updatedThread);
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
