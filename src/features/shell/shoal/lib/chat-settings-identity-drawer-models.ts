import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsConnectionDrawerModel {
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
  hasMissingPersona: boolean;
  open: boolean;
  selectedPersonaId: string;
  summary: string;
}

interface ChatSettingsIdentityDrawerModelsInput {
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsIdentityDrawerModels {
  connection: ChatSettingsConnectionDrawerModel;
  persona: ChatSettingsPersonaDrawerModel;
}

export function getChatSettingsIdentityDrawerModels({
  openDrawers,
  viewModel,
}: ChatSettingsIdentityDrawerModelsInput): ChatSettingsIdentityDrawerModels {
  return {
    connection: {
      connections: viewModel.sanitizedProviderConnections,
      fallbackConnection: viewModel.fallbackConnection,
      fallbackConnectionPrefix: viewModel.fallbackConnectionPrefix,
      hasMissingConnection: viewModel.hasMissingConnection,
      messengerConnectionValue: viewModel.messengerConnectionValue,
      missingConnectionResolution: viewModel.missingConnectionResolution,
      open: openDrawers.connection,
      summary: viewModel.connectionSummary,
    },
    persona: {
      hasMissingPersona: viewModel.hasMissingPersona,
      open: openDrawers.persona,
      selectedPersonaId: viewModel.selectedPersonaId,
      summary: viewModel.personaSummary,
    },
  };
}
