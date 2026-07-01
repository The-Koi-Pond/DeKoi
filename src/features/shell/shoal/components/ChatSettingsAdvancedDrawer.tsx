import {
  ChatSettingsAdvancedControls,
  type AdvancedChatSettings,
} from "./ChatSettingsAdvancedControls";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsAdvancedDrawerProps {
  appSettings: AdvancedChatSettings;
  open: boolean;
  settingsLabel: string;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  updateAppSettings: (settings: Partial<AdvancedChatSettings>) => void;
}

export function ChatSettingsAdvancedDrawer({
  appSettings,
  open,
  settingsLabel,
  onToggle,
  updateAppSettings,
}: ChatSettingsAdvancedDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="advanced"
      open={open}
      summary="Temperature and limits"
      title="Advanced Parameters"
      onToggle={onToggle}
    >
      <ChatSettingsAdvancedControls
        appSettings={appSettings}
        settingsLabel={settingsLabel}
        updateAppSettings={updateAppSettings}
      />
    </ChatSettingsDrawer>
  );
}
