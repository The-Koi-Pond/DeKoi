import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsConnectionDrawerModel {
  activeMessengerThread: boolean;
  connections: ChatSettingsViewModel["sanitizedProviderConnections"];
  fallbackConnection: ChatSettingsViewModel["fallbackConnection"];
  fallbackConnectionPrefix: string;
  hasMissingConnection: boolean;
  messengerConnectionValue: string;
  missingConnectionResolution: ChatSettingsViewModel["missingConnectionResolution"];
  open: boolean;
  summary: string;
}

export interface ChatSettingsPersonaDrawerModel {
  activeMessengerThread: boolean;
  hasMissingPersona: boolean;
  open: boolean;
  selectedPersonaId: string;
  summary: string;
}

interface ChatSettingsIdentityDrawerModelsInput {
  activeThread: boolean;
  openDrawers: Pick<Record<ChatSettingsDrawerId, boolean>, "connection" | "persona">;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsIdentityDrawerModels {
  connection: ChatSettingsConnectionDrawerModel;
  persona: ChatSettingsPersonaDrawerModel;
}

export function getChatSettingsIdentityDrawerModels({
  activeThread,
  openDrawers,
  viewModel,
}: ChatSettingsIdentityDrawerModelsInput): ChatSettingsIdentityDrawerModels {
  return {
    connection: {
      activeMessengerThread: activeThread,
      connections: viewModel.sanitizedProviderConnections,
      fallbackConnection: viewModel.fallbackConnection,
      fallbackConnectionPrefix: viewModel.fallbackConnectionPrefix,
      hasMissingConnection: viewModel.hasMissingConnection,
      messengerConnectionValue: viewModel.messengerConnectionValue,
      missingConnectionResolution: viewModel.missingConnectionResolution,
      open: activeThread && openDrawers.connection,
      summary: viewModel.connectionSummary,
    },
    persona: {
      activeMessengerThread: activeThread,
      hasMissingPersona: viewModel.hasMissingPersona,
      open: activeThread && openDrawers.persona,
      selectedPersonaId: viewModel.selectedPersonaId,
      summary: viewModel.personaSummary,
    },
  };
}
