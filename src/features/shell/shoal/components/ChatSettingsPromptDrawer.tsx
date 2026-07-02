import type { MessengerSystemPromptMode } from "../../../../engine/contracts/types/messenger";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsDropdown } from "./ChatSettingsDropdown";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsPromptDrawerProps {
  activeMessengerThread: boolean;
  open: boolean;
  systemPromptMode: MessengerSystemPromptMode;
  onOpenPromptEditor: () => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPromptDrawer({
  activeMessengerThread,
  open,
  systemPromptMode,
  onOpenPromptEditor,
  onSystemPromptModeChange,
  onToggle,
}: ChatSettingsPromptDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="prompt"
      open={open}
      summary={
        systemPromptMode === "custom"
          ? "Custom system prompt"
          : "Default system prompt"
      }
      title="Messenger Prompt"
      onToggle={onToggle}
    >
      <div className="chat-settings-field">
        <span id="chat-settings-prompt-label">Messenger system prompt</span>
        <div className="chat-settings-prompt-select">
          <ChatSettingsDropdown
            value={systemPromptMode}
            labelledBy="chat-settings-prompt-label"
            menuId="chat-settings-prompt-menu"
            options={[
              { label: "Default", value: "default" },
              { label: "Custom", value: "custom" },
            ]}
            disabled={!activeMessengerThread}
            onChange={(value) =>
              onSystemPromptModeChange(value as MessengerSystemPromptMode)
            }
          />
          <button
            type="button"
            className="chat-settings-edit-button"
            disabled={!activeMessengerThread}
            onClick={onOpenPromptEditor}
          >
            Edit
          </button>
        </div>
      </div>
    </ChatSettingsDrawer>
  );
}
