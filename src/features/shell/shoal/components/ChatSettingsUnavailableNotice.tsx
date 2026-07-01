import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";

interface ChatSettingsUnavailableNoticeProps {
  settingsLabel: string;
  onCloseChatSettings: () => void;
}

export function ChatSettingsUnavailableNotice({
  settingsLabel,
  onCloseChatSettings,
}: ChatSettingsUnavailableNoticeProps) {
  return (
    <>
      <ChatSettingsRailHead
        settingsLabel={settingsLabel}
        onCloseChatSettings={onCloseChatSettings}
      />
      <div className="shoal-list chat-settings-list">
        <ChatSettingsNotice>
          Roleplay settings are not ready yet. Open a Messenger thread to adjust
          Messenger-specific connection, persona, companion, prompt, and lore
          settings.
        </ChatSettingsNotice>
      </div>
    </>
  );
}
