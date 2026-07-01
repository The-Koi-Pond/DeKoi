import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { useChatSettingsPromptEditor } from "../hooks/use-chat-settings-prompt-editor";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsPromptResourceModel } from "../lib/chat-settings-resource-drawer-models";
import { ChatSettingsPromptDrawer } from "./ChatSettingsPromptDrawer";
import { ChatSettingsPromptEditor } from "./ChatSettingsPromptEditor";

interface ChatSettingsPromptControlsProps {
  activeMessengerThreadRecord: MessengerThread | null;
  activeMessengerThreadId: string | null;
  model: ChatSettingsPromptResourceModel;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPromptControls({
  activeMessengerThreadRecord,
  activeMessengerThreadId,
  model,
  onSaveCustomPrompt,
  onSystemPromptModeChange,
  onToggle,
}: ChatSettingsPromptControlsProps) {
  const {
    activePromptEditor,
    closePromptEditor,
    openPromptEditor,
    savePromptEditor,
    updatePromptEditorValue,
  } = useChatSettingsPromptEditor({
    activeMessengerThread: activeMessengerThreadRecord,
    activeMessengerThreadId,
    onSaveCustomPrompt,
  });

  return (
    <>
      <ChatSettingsPromptDrawer
        activeMessengerThread={model.activeMessengerThread}
        open={model.open}
        systemPromptMode={model.systemPromptMode}
        onOpenPromptEditor={openPromptEditor}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
      />
      <ChatSettingsPromptEditor
        open={activePromptEditor.open && model.activeMessengerThread}
        value={activePromptEditor.value}
        onClose={closePromptEditor}
        onSave={savePromptEditor}
        onValueChange={updatePromptEditorValue}
      />
    </>
  );
}
