import {
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadProviderConnection,
  setMessengerThreadSystemPrompt,
} from "../../../../engine/modes/messenger/messenger-actions";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";
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
    onUpdateMessengerThread(
      updater(activeMessengerThread, new Date().toISOString()),
    );
  }

  function handleMessengerConnectionChange(connectionId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadProviderConnection(
        thread,
        connectionId.trim() || null,
        updatedAt,
      ),
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
        thread.characterIds.includes(characterId)
          ? thread.characterIds.filter((id) => id !== characterId)
          : [...thread.characterIds, characterId],
        updatedAt,
      ),
    );
  }

  function toggleMessengerLorebook(lorebookId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadLorebooks(
        thread,
        thread.lorebookIds.includes(lorebookId)
          ? thread.lorebookIds.filter((id) => id !== lorebookId)
          : [...thread.lorebookIds, lorebookId],
        updatedAt,
      ),
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

  function handleMessengerSystemPromptModeChange(
    systemPromptMode: MessengerSystemPromptMode,
  ) {
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

  return {
    clearMissingMessengerCompanions,
    clearMissingMessengerLorebooks,
    handleMessengerConnectionChange,
    handleMessengerPersonaChange,
    handleMessengerSystemPromptModeChange,
    resolveMissingMessengerConnection,
    saveCustomMessengerPrompt,
    toggleMessengerCompanion,
    toggleMessengerLorebook,
  };
}
