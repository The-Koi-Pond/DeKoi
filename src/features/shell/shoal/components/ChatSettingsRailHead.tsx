import { ChatSettingsNameEditor } from "./ChatSettingsNameEditor";

interface ChatSettingsRailHeadProps {
  activeChatName?: string;
  chatNameDisabled?: boolean;
  chatNameEditing?: boolean;
  chatNameValue?: string;
  settingsLabel: string;
  showChatNameEditor?: boolean;
  onCancelChatNameEdit?: () => void;
  onChatNameValueChange?: (value: string) => void;
  onCloseChatSettings: () => void;
  onSaveChatName?: () => void;
  onStartChatNameEdit?: () => void;
}

export function ChatSettingsRailHead({
  activeChatName = "",
  chatNameDisabled = true,
  chatNameEditing = false,
  chatNameValue = "",
  settingsLabel,
  showChatNameEditor = false,
  onCancelChatNameEdit,
  onChatNameValueChange,
  onCloseChatSettings,
  onSaveChatName,
  onStartChatNameEdit,
}: ChatSettingsRailHeadProps) {
  return (
    <div className="shoal-head chat-settings-head">
      <div className="shoal-title chat-settings-title">
        <h2>{settingsLabel}</h2>
        <button
          type="button"
          className="chat-settings-close"
          aria-label="Close chat settings"
          title="Close chat settings"
          onClick={onCloseChatSettings}
        >
          ×
        </button>
      </div>
      {showChatNameEditor && (
        <ChatSettingsNameEditor
          activeChatName={activeChatName}
          disabled={chatNameDisabled}
          editing={chatNameEditing}
          value={chatNameValue}
          onCancel={onCancelChatNameEdit ?? noop}
          onSave={onSaveChatName ?? noop}
          onStartEdit={onStartChatNameEdit ?? noop}
          onValueChange={onChatNameValueChange ?? noop}
        />
      )}
    </div>
  );
}

function noop() {
  return undefined;
}
