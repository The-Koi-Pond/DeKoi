import type { ChatSettingsThreadRecord } from "./chat-settings-thread-record";
import type { ChatSettingsMessengerSettings } from "./chat-settings-controller-groups";
import {
  getChatSettingsIdentityDrawerModels,
  type ChatSettingsIdentityDrawerModels,
} from "./chat-settings-identity-drawer-models";
import {
  getChatSettingsResourceDrawerModels,
  type ChatSettingsResourceDrawerModels,
} from "./chat-settings-resource-drawer-models";

export interface ChatSettingsMessengerDrawerModels {
  activeMessengerThread: ChatSettingsThreadRecord | null;
  companionSelectorOpen: boolean;
  identity: ChatSettingsIdentityDrawerModels;
  resources: ChatSettingsResourceDrawerModels;
}

interface ChatSettingsMessengerDrawerModelsInput {
  settings: ChatSettingsMessengerSettings;
}

export function getChatSettingsMessengerDrawerModels({
  settings,
}: ChatSettingsMessengerDrawerModelsInput): ChatSettingsMessengerDrawerModels {
  const { activeMessengerThread, chatSettingsViewModel, companionSelectorOpen, openDrawers } =
    settings;
  const chatSettingsActive = !!activeMessengerThread;
  const modelInput = {
    activeThread: chatSettingsActive,
    openDrawers,
    viewModel: chatSettingsViewModel,
  };

  return {
    activeMessengerThread,
    companionSelectorOpen,
    identity: getChatSettingsIdentityDrawerModels(modelInput),
    resources: getChatSettingsResourceDrawerModels(modelInput),
  };
}
