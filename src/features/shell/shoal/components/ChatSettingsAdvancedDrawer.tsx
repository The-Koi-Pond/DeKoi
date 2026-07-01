import { ChatSettingsAdvancedControls } from "./ChatSettingsAdvancedControls";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type {
  AdvancedChatSettings,
  ChatSettingsAdvancedDrawerModel,
} from "../lib/chat-settings-advanced-drawer-models";

interface ChatSettingsAdvancedDrawerProps {
  model: ChatSettingsAdvancedDrawerModel;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onUpdateAppSettings: (settings: Partial<AdvancedChatSettings>) => void;
}

export function ChatSettingsAdvancedDrawer({
  model,
  onToggle,
  onUpdateAppSettings,
}: ChatSettingsAdvancedDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="advanced"
      open={model.open}
      summary={model.summary}
      title="Advanced Parameters"
      onToggle={onToggle}
    >
      <ChatSettingsAdvancedControls
        model={model}
        onUpdateAppSettings={onUpdateAppSettings}
      />
    </ChatSettingsDrawer>
  );
}
