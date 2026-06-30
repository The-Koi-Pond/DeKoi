import type { MessengerSystemPromptMode } from "../../../../engine/contracts/types/messenger";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
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
      <label className="chat-settings-field">
        <span>Messenger system prompt</span>
        <div className="chat-settings-prompt-select">
          <select
            className="pondsel"
            value={systemPromptMode}
            disabled={!activeMessengerThread}
            onChange={(event) =>
              onSystemPromptModeChange(
                event.currentTarget.value as MessengerSystemPromptMode,
              )
            }
          >
            <option value="default">Default</option>
            <option value="custom">Custom</option>
          </select>
          <button
            type="button"
            className="chat-settings-edit-button"
            disabled={!activeMessengerThread}
            onClick={onOpenPromptEditor}
          >
            Edit
          </button>
        </div>
      </label>
    </ChatSettingsDrawer>
  );
}
