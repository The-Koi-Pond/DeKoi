import type { AppSettings } from "../../../../engine/contracts/types/app-settings";

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
  open: boolean;
  settingsLabel: string;
}

export function getChatSettingsAdvancedDrawerModel({
  appSettings,
  open,
  settingsLabel,
}: ChatSettingsAdvancedDrawerModelInput): ChatSettingsAdvancedDrawerModel {
  return {
    open,
    settings: appSettings,
    settingsLabel,
    summary: "Temperature and limits",
  };
}
