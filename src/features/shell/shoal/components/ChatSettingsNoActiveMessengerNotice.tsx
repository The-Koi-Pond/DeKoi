import { ChatSettingsNotice } from "./ChatSettingsBlocks";

interface ChatSettingsNoActiveMessengerNoticeProps {
  onCreateMessengerThread: () => void;
}

export function ChatSettingsNoActiveMessengerNotice({
  onCreateMessengerThread,
}: ChatSettingsNoActiveMessengerNoticeProps) {
  return (
    <ChatSettingsNotice
      actionLabel="New Messenger"
      onAction={onCreateMessengerThread}
    >
      Open or create a Messenger thread to edit connection, persona, companion,
      prompt, and lore settings.
    </ChatSettingsNotice>
  );
}
