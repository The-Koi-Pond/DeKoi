import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import { useChatSettingsNameEditor } from "../hooks/use-chat-settings-name-editor";
import type { ShoalNav } from "../types";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";

interface ChatSettingsNameControlsProps {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  settingsLabel: string;
  onCloseChatSettings: () => void;
  onRenameMessengerThread: ShoalNav["renameMessengerThread"];
}

export function ChatSettingsNameControls({
  activeMessengerThread,
  activeMessengerThreadId,
  settingsLabel,
  onCloseChatSettings,
  onRenameMessengerThread,
}: ChatSettingsNameControlsProps) {
  const {
    activeChatName,
    activeChatNameEditor,
    cancelChatNameEdit,
    saveChatName,
    startChatNameEdit,
    updateChatNameValue,
  } = useChatSettingsNameEditor({
    activeMessengerThread,
    activeMessengerThreadId,
    onRenameMessengerThread,
  });

  return (
    <ChatSettingsRailHead
      activeChatName={activeChatName}
      chatNameDisabled={!activeMessengerThread}
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
