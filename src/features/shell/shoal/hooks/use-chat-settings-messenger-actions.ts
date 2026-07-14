import {
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadPreset,
  setMessengerThreadPresetChoiceSelections,
  setMessengerThreadProviderConnection,
} from "../../../../engine/modes/messenger/messenger-actions";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PromptPresetThreadChoiceSelections } from "../../../../engine/contracts/types/prompt-presets";
import type {
  ChatSettingsMessengerIdentityActions,
  ChatSettingsMessengerThreadResourceActions,
  ChatSettingsThreadPresetActions,
} from "../lib/chat-settings-controller-groups";
import { toggleSelectedId } from "../lib/toggle-selected-id";
import type { ShoalNav } from "../types";

interface UseChatSettingsMessengerActionsInput {
  activeMessengerThread: MessengerThread | null;
  characters: ShoalNav["characters"];
  lorebooks: ShoalNav["lorebooks"];
  onCompanionSelectorOpenChange: (open: boolean) => void;
  onUpdateMessengerThreadById: ShoalNav["updateMessengerThreadById"];
}

export function transformMessengerPresetConfirm(
  thread: MessengerThread,
  presetId: string,
  selections: PromptPresetThreadChoiceSelections,
  updatedAt: string,
): MessengerThread {
  const next = setMessengerThreadPreset(thread, presetId, updatedAt, selections);
  return next;
}

export function useChatSettingsMessengerActions({
  activeMessengerThread,
  characters,
  lorebooks,
  onCompanionSelectorOpenChange,
  onUpdateMessengerThreadById,
}: UseChatSettingsMessengerActionsInput) {
  function updateActiveMessengerThread(
    updater: (thread: MessengerThread, updatedAt: string) => MessengerThread,
  ) {
    if (!activeMessengerThread) return;
    onUpdateMessengerThreadById(activeMessengerThread.id, (thread) =>
      updater(thread, new Date().toISOString()),
    );
  }

  function handleMessengerConnectionChange(connectionId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadProviderConnection(thread, connectionId.trim() || null, updatedAt),
    );
  }

  function handleMessengerPersonaChange(personaId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadPersona(thread, personaId.trim() || null, updatedAt),
    );
  }

  function toggleMessengerCompanion(characterId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadParticipants(
        thread,
        toggleSelectedId(thread.characterIds, characterId),
        updatedAt,
      ),
    );
  }

  function toggleMessengerLorebook(lorebookId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadLorebooks(
        thread,
        toggleSelectedId(thread.lorebookIds, lorebookId),
        updatedAt,
      ),
    );
  }

  function handleMessengerPresetChange(presetId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadPreset(thread, presetId.trim() || null, updatedAt),
    );
  }

  function handleMessengerPresetChoiceChange(selections: PromptPresetThreadChoiceSelections) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadPresetChoiceSelections(thread, selections, updatedAt),
    );
  }

  function handleMessengerPresetConfirm(
    presetId: string,
    selections: PromptPresetThreadChoiceSelections,
  ) {
    updateActiveMessengerThread((thread, updatedAt) =>
      transformMessengerPresetConfirm(thread, presetId, selections, updatedAt),
    );
  }

  function clearMissingMessengerPreset() {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadPreset(thread, null, updatedAt),
    );
  }

  function resolveMissingMessengerConnection(connectionId: string | null) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadProviderConnection(thread, connectionId, updatedAt),
    );
  }

  function clearMissingMessengerCompanions() {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadParticipants(
        thread,
        thread.characterIds.filter((characterId) =>
          characters.some((character) => character.id === characterId),
        ),
        updatedAt,
      ),
    );
    onCompanionSelectorOpenChange(false);
  }

  function clearMissingMessengerLorebooks() {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadLorebooks(
        thread,
        thread.lorebookIds.filter((lorebookId) =>
          lorebooks.some((lorebook) => lorebook.id === lorebookId),
        ),
        updatedAt,
      ),
    );
  }

  const identityActions: ChatSettingsMessengerIdentityActions = {
    onConnectionChange: handleMessengerConnectionChange,
    onPersonaChange: handleMessengerPersonaChange,
    onResolveMissingConnection: resolveMissingMessengerConnection,
  };
  const presetActions: ChatSettingsThreadPresetActions = {
    onClearMissingPreset: clearMissingMessengerPreset,
    onPresetChoiceChange: handleMessengerPresetChoiceChange,
    onPresetConfirm: handleMessengerPresetConfirm,
    onPresetChange: handleMessengerPresetChange,
  };
  const resourceActions: ChatSettingsMessengerThreadResourceActions = {
    clearMissingCompanions: clearMissingMessengerCompanions,
    clearMissingLorebooks: clearMissingMessengerLorebooks,
    onToggleCompanion: toggleMessengerCompanion,
    onToggleLorebook: toggleMessengerLorebook,
  };

  return {
    identityActions,
    presetActions,
    resourceActions,
  };
}
