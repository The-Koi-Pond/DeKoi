import {
  setRoleplayThreadLorebooks,
  setRoleplayThreadParticipants,
  setRoleplayThreadPersona,
  setRoleplayThreadProviderConnection,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type {
  ChatSettingsIdentityActions,
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
    onUpdateRoleplayThread(updater(activeRoleplayThread, new Date().toISOString()));
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
  const resourceActions: ChatSettingsThreadResourceActions = {
    clearMissingCompanions: clearMissingRoleplayCompanions,
    clearMissingLorebooks: clearMissingRoleplayLorebooks,
    onToggleCompanion: toggleRoleplayCompanion,
    onToggleLorebook: toggleRoleplayLorebook,
  };

  return {
    identityActions,
    resourceActions,
  };
}
