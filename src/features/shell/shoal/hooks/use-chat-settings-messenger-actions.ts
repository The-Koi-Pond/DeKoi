import {
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadPreset,
  setMessengerThreadProviderConnection,
  setMessengerThreadSystemPrompt,
} from "../../../../engine/modes/messenger/messenger-actions";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import type {
  ChatSettingsMessengerIdentityActions,
  ChatSettingsMessengerPromptActions,
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
  onUpdateMessengerThread: ShoalNav["updateMessengerThread"];
}

export function useChatSettingsMessengerActions({
  activeMessengerThread,
  characters,
  lorebooks,
  onCompanionSelectorOpenChange,
  onUpdateMessengerThread,
}: UseChatSettingsMessengerActionsInput) {
  function updateActiveMessengerThread(
    updater: (thread: MessengerThread, updatedAt: string) => MessengerThread,
  ) {
    if (!activeMessengerThread) return;
    onUpdateMessengerThread(updater(activeMessengerThread, new Date().toISOString()));
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

  function handleMessengerSystemPromptModeChange(systemPromptMode: MessengerSystemPromptMode) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadSystemPrompt(
        thread,
        systemPromptMode,
        thread.systemPrompt || DEFAULT_MESSENGER_SYSTEM_PROMPT,
        updatedAt,
      ),
    );
  }

  function saveCustomMessengerPrompt(threadId: string, prompt: string) {
    if (activeMessengerThread?.id !== threadId) return;
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadSystemPrompt(thread, "custom", prompt, updatedAt),
    );
  }

  const identityActions: ChatSettingsMessengerIdentityActions = {
    onConnectionChange: handleMessengerConnectionChange,
    onPersonaChange: handleMessengerPersonaChange,
    onResolveMissingConnection: resolveMissingMessengerConnection,
  };
  const promptActions: ChatSettingsMessengerPromptActions = {
    onSaveCustomPrompt: saveCustomMessengerPrompt,
    onSystemPromptModeChange: handleMessengerSystemPromptModeChange,
  };
  const presetActions: ChatSettingsThreadPresetActions = {
    onClearMissingPreset: clearMissingMessengerPreset,
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
    promptActions,
    resourceActions,
  };
}
