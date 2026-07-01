import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type {
  ChatSettingsMessengerSettings,
} from "./chat-settings-controller-groups";
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

export interface ChatSettingsMessengerDrawerModels {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  advanced: ChatSettingsAdvancedDrawerModel;
  companionSelectorOpen: boolean;
  identity: ChatSettingsIdentityDrawerModels;
  resources: ChatSettingsResourceDrawerModels;
}

interface ChatSettingsMessengerDrawerModelsInput {
  appSettings: AdvancedChatSettings;
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
}

export function getChatSettingsMessengerDrawerModels({
  appSettings,
  settings,
  settingsLabel,
}: ChatSettingsMessengerDrawerModelsInput): ChatSettingsMessengerDrawerModels {
  const {
    activeMessengerThread,
    activeMessengerThreadId,
    chatSettingsViewModel,
    companionSelectorOpen,
    openDrawers,
  } = settings;
  const chatSettingsActive = !!activeMessengerThread;
  const modelInput = {
    activeMessengerThread: chatSettingsActive,
    openDrawers,
    viewModel: chatSettingsViewModel,
  };

  return {
    activeMessengerThread,
    activeMessengerThreadId,
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
