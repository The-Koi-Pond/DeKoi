import { useChatSettingsNameEditor } from "../hooks/use-chat-settings-name-editor";
import type { ChatSettingsThreadRecord } from "../lib/chat-settings-thread-record";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";

interface ChatSettingsNameControlsProps {
  activeThread: ChatSettingsThreadRecord | null;
  activeThreadId: string | null;
  settingsLabel: string;
  onCloseChatSettings: () => void;
  onRenameThread: (threadId: string, title: string) => void;
}

export function ChatSettingsNameControls({
  activeThread,
  activeThreadId,
  settingsLabel,
  onCloseChatSettings,
  onRenameThread,
}: ChatSettingsNameControlsProps) {
  const {
    activeChatName,
    activeChatNameEditor,
    cancelChatNameEdit,
    saveChatName,
    startChatNameEdit,
    updateChatNameValue,
  } = useChatSettingsNameEditor({
    activeThread,
    activeThreadId,
    onRenameThread,
  });

  return (
    <ChatSettingsRailHead
      activeChatName={activeChatName}
      chatNameDisabled={!activeThread}
      chatNameEditing={activeChatNameEditor.editing}
      chatNameValue={activeChatNameEditor.value}
      settingsLabel={settingsLabel}
      showChatNameEditor
      onCancelChatNameEdit={cancelChatNameEdit}
      onChatNameValueChange={updateChatNameValue}
      onCloseChatSettings={onCloseChatSettings}
      onSaveChatName={saveChatName}
      onStartChatNameEdit={startChatNameEdit}
    />
  );
}
