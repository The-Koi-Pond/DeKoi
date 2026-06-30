import { ChatSettingsNameEditor } from "./ChatSettingsNameEditor";

interface ChatSettingsRailHeadBaseProps {
  settingsLabel: string;
  onCloseChatSettings: () => void;
}

type ChatSettingsRailHeadProps =
  | (ChatSettingsRailHeadBaseProps & {
      showChatNameEditor?: false;
    })
  | (ChatSettingsRailHeadBaseProps & {
      activeChatName: string;
      chatNameDisabled: boolean;
      chatNameEditing: boolean;
      chatNameValue: string;
      showChatNameEditor: true;
      onCancelChatNameEdit: () => void;
      onChatNameValueChange: (value: string) => void;
      onSaveChatName: () => void;
      onStartChatNameEdit: () => void;
    });

export function ChatSettingsRailHead(props: ChatSettingsRailHeadProps) {
  const {
    settingsLabel,
    onCloseChatSettings,
  } = props;

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
      {props.showChatNameEditor && (
        <ChatSettingsNameEditor
          activeChatName={props.activeChatName}
          disabled={props.chatNameDisabled}
          editing={props.chatNameEditing}
          value={props.chatNameValue}
          onCancel={props.onCancelChatNameEdit}
          onSave={props.onSaveChatName}
          onStartEdit={props.onStartChatNameEdit}
          onValueChange={props.onChatNameValueChange}
        />
      )}
    </div>
  );
}
