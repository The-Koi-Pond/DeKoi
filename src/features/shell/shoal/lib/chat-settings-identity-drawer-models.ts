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
  activeMessengerThread: boolean;
  openDrawers: Pick<Record<ChatSettingsDrawerId, boolean>, "connection" | "persona">;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsIdentityDrawerModels {
  connection: ChatSettingsConnectionDrawerModel;
  persona: ChatSettingsPersonaDrawerModel;
}

export function getChatSettingsIdentityDrawerModels({
  activeMessengerThread,
  openDrawers,
  viewModel,
}: ChatSettingsIdentityDrawerModelsInput): ChatSettingsIdentityDrawerModels {
  return {
    connection: {
      activeMessengerThread,
      connections: viewModel.sanitizedProviderConnections,
      fallbackConnection: viewModel.fallbackConnection,
      fallbackConnectionPrefix: viewModel.fallbackConnectionPrefix,
      hasMissingConnection: viewModel.hasMissingConnection,
      messengerConnectionValue: viewModel.messengerConnectionValue,
      missingConnectionResolution: viewModel.missingConnectionResolution,
      open: activeMessengerThread && openDrawers.connection,
      summary: viewModel.connectionSummary,
    },
    persona: {
      activeMessengerThread,
      hasMissingPersona: viewModel.hasMissingPersona,
      open: activeMessengerThread && openDrawers.persona,
      selectedPersonaId: viewModel.selectedPersonaId,
      summary: viewModel.personaSummary,
    },
  };
}
