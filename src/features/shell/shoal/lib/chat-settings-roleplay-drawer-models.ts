import type { ChatSettingsThreadRecord } from "./chat-settings-thread-record";
import type { ChatSettingsRoleplaySettings } from "./chat-settings-controller-groups";
import {
  getChatSettingsAdvancedDrawerModel,
  type AdvancedChatSettings,
  type ChatSettingsAdvancedDrawerModel,
} from "./chat-settings-advanced-drawer-models";
import {
  getChatSettingsIdentityDrawerModels,
  type ChatSettingsIdentityDrawerModels,
} from "./chat-settings-identity-drawer-models";
import {
  getChatSettingsResourceDrawerModels,
  type ChatSettingsResourceDrawerModels,
} from "./chat-settings-resource-drawer-models";

export interface ChatSettingsRoleplayDrawerModels {
  activeRoleplayThread: ChatSettingsThreadRecord | null;
  activeRoleplayThreadId: string | null;
  advanced: ChatSettingsAdvancedDrawerModel;
  companionSelectorOpen: boolean;
  identity: ChatSettingsIdentityDrawerModels;
  resources: ChatSettingsResourceDrawerModels;
}

interface ChatSettingsRoleplayDrawerModelsInput {
  appSettings: AdvancedChatSettings;
  settings: ChatSettingsRoleplaySettings;
  settingsLabel: string;
}

export function getChatSettingsRoleplayDrawerModels({
  appSettings,
  settings,
  settingsLabel,
}: ChatSettingsRoleplayDrawerModelsInput): ChatSettingsRoleplayDrawerModels {
  const {
    activeRoleplayThread,
    activeRoleplayThreadId,
    chatSettingsViewModel,
    companionSelectorOpen,
    openDrawers,
  } = settings;
  const chatSettingsActive = !!activeRoleplayThread;
  const modelInput = {
    activeThread: chatSettingsActive,
    openDrawers,
    viewModel: chatSettingsViewModel,
  };

  return {
    activeRoleplayThread,
    activeRoleplayThreadId,
    advanced: getChatSettingsAdvancedDrawerModel({
      appSettings,
      open: chatSettingsActive && openDrawers.advanced,
      settingsLabel,
    }),
    companionSelectorOpen,
    identity: getChatSettingsIdentityDrawerModels(modelInput),
    resources: getChatSettingsResourceDrawerModels(modelInput),
  };
}
