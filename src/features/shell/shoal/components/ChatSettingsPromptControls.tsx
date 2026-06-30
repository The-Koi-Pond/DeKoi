import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { useChatSettingsPromptEditor } from "../hooks/use-chat-settings-prompt-editor";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import { ChatSettingsPromptDrawer } from "./ChatSettingsPromptDrawer";
import { ChatSettingsPromptEditor } from "./ChatSettingsPromptEditor";

interface ChatSettingsPromptControlsProps {
  activeMessengerThread: boolean;
  activeMessengerThreadRecord: MessengerThread | null;
  activeMessengerThreadId: string | null;
  open: boolean;
  systemPromptMode: MessengerSystemPromptMode;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPromptControls({
  activeMessengerThread,
  activeMessengerThreadRecord,
  activeMessengerThreadId,
  open,
  systemPromptMode,
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
        activeMessengerThread={activeMessengerThread}
        open={open}
        systemPromptMode={systemPromptMode}
        onOpenPromptEditor={openPromptEditor}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
      />
      <ChatSettingsPromptEditor
        open={activePromptEditor.open && activeMessengerThread}
        value={activePromptEditor.value}
        onClose={closePromptEditor}
        onSave={savePromptEditor}
        onValueChange={updatePromptEditorValue}
      />
    </>
  );
}
