import { ChatSettingsMessengerRailContent } from "./ChatSettingsMessengerRailContent";
import { ChatSettingsRailShell } from "./ChatSettingsRailShell";
import { ChatSettingsRoleplayRailContent } from "./ChatSettingsRoleplayRailContent";
import { ChatSettingsUnavailableNotice } from "./ChatSettingsUnavailableNotice";
import { useChatSettingsRailController } from "../hooks/use-chat-settings-rail-controller";
import type { ShoalRailProps } from "../types";

export function ChatSettingsRail({
  chatSettingsOpen,
  nav,
  onCloseChatSettings,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const {
    isMessengerSettings,
    isRoleplaySettings,
    messengerActions,
    messengerSettings,
    roleplayActions,
    roleplaySettings,
    settingsLabel,
  } = useChatSettingsRailController({ nav });

  return (
    <ChatSettingsRailShell
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      settingsLabel={settingsLabel}
      shoalClosed={shoalClosed}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
    >
      {isMessengerSettings ? (
        <ChatSettingsMessengerRailContent
          actions={messengerActions}
          settings={messengerSettings}
          nav={nav}
          settingsLabel={settingsLabel}
          onCloseChatSettings={onCloseChatSettings}
        />
      ) : isRoleplaySettings ? (
        <ChatSettingsRoleplayRailContent
          actions={roleplayActions}
          settings={roleplaySettings}
          nav={nav}
          settingsLabel={settingsLabel}
          onCloseChatSettings={onCloseChatSettings}
        />
      ) : (
        <ChatSettingsUnavailableNotice
          settingsLabel={settingsLabel}
          onCloseChatSettings={onCloseChatSettings}
        />
      )}
    </ChatSettingsRailShell>
  );
}
