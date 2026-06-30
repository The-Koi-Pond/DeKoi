import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import {
  sanitizeProviderConnectionRecord,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import {
  getConnectionSettingsViewModel,
  getPersonaSettingsViewModel,
} from "./chat-settings-identity-view-model";
import {
  getCompanionSettingsViewModel,
  getLorebookSettingsViewModel,
} from "./chat-settings-selection-view-model";

interface ChatSettingsViewModelInput {
  activeMessengerThread: MessengerThread | null;
  appSettings: AppSettings;
  characters: readonly CharacterRecord[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
}

export function getChatSettingsViewModel({
  activeMessengerThread,
  appSettings,
  characters,
  lorebooks,
  personas,
  providerConnections,
}: ChatSettingsViewModelInput) {
  const sanitizedProviderConnections = providerConnections.map((connection) =>
    sanitizeProviderConnectionRecord(connection),
  );
  const systemPromptMode = activeMessengerThread?.systemPromptMode ?? "default";

  return {
    ...getConnectionSettingsViewModel({
      activeMessengerThread,
      appSettings,
      sanitizedProviderConnections,
    }),
    ...getPersonaSettingsViewModel({
      activeMessengerThread,
      personas,
    }),
    ...getCompanionSettingsViewModel({
      activeMessengerThread,
      characters,
    }),
    ...getLorebookSettingsViewModel({
      activeMessengerThread,
      lorebooks,
    }),
    sanitizedProviderConnections,
    systemPromptMode,
  };
}

export type ChatSettingsViewModel = ReturnType<typeof getChatSettingsViewModel>;
