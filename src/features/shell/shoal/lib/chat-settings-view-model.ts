import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
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
import type { ChatSettingsThreadRecord } from "./chat-settings-thread-record";

interface ChatSettingsViewModelInput {
  activeMessengerThread?: MessengerThread | null;
  activeThread?: ChatSettingsThreadRecord | null;
  appSettings: AppSettings;
  characters: readonly CharacterRecord[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  promptPresets: readonly PromptPresetRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
  threadLabel?: string;
}

export function getChatSettingsViewModel({
  activeMessengerThread = null,
  activeThread: explicitActiveThread,
  appSettings,
  characters,
  lorebooks,
  personas,
  promptPresets,
  providerConnections,
  threadLabel = "Messenger",
}: ChatSettingsViewModelInput) {
  const activeThread = explicitActiveThread ?? activeMessengerThread;
  const sanitizedProviderConnections = providerConnections.map((connection) =>
    sanitizeProviderConnectionRecord(connection),
  );
  const systemPromptMode = activeThread?.systemPromptMode ?? "default";
  const selectedPresetId = activeThread?.presetId ?? null;
  const selectedPreset =
    selectedPresetId !== null
      ? (promptPresets.find((preset) => preset.id === selectedPresetId) ?? null)
      : null;
  const missingPresetId = selectedPresetId && !selectedPreset ? selectedPresetId : null;

  return {
    ...getConnectionSettingsViewModel({
      activeThread,
      appSettings,
      sanitizedProviderConnections,
      threadLabel,
    }),
    ...getPersonaSettingsViewModel({
      activeThread,
      personas,
      threadLabel,
    }),
    ...getCompanionSettingsViewModel({
      activeThread,
      characters,
      threadLabel,
    }),
    ...getLorebookSettingsViewModel({
      activeThread,
      lorebooks,
      threadLabel,
    }),
    sanitizedProviderConnections,
    missingPresetId,
    presetDrawerSummary: selectedPreset
      ? selectedPreset.title
      : missingPresetId
        ? "Missing preset"
        : "No preset",
    selectedPresetId,
    systemPromptMode,
  };
}

export type ChatSettingsViewModel = ReturnType<typeof getChatSettingsViewModel>;
