import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { ChatSettingsDrawerId } from "./chat-settings-drawers";

export type AdvancedChatSettings = Pick<
  AppSettings,
  "defaultTemperature" | "defaultMaxTokens" | "defaultTopP"
>;

export interface ChatSettingsAdvancedDrawerModel {
  open: boolean;
  settings: AdvancedChatSettings;
  settingsLabel: string;
  summary: string;
}

interface ChatSettingsAdvancedDrawerModelInput {
  appSettings: AdvancedChatSettings;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  settingsLabel: string;
}

export function getChatSettingsAdvancedDrawerModel({
  appSettings,
  openDrawers,
  settingsLabel,
}: ChatSettingsAdvancedDrawerModelInput): ChatSettingsAdvancedDrawerModel {
  return {
    open: openDrawers.advanced,
    settings: appSettings,
    settingsLabel,
    summary: "Temperature and limits",
  };
}
