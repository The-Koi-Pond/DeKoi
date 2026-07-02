import { ChatSettingsMessengerDrawerHost } from "./ChatSettingsMessengerDrawerHost";
import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerRailContentProps {
  actions: ChatSettingsMessengerActionGroup;
  nav: ShoalRailProps["nav"];
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
  onCloseChatSettings: () => void;
}

export function ChatSettingsMessengerRailContent({
  actions,
  nav,
  settings,
  settingsLabel,
  onCloseChatSettings,
}: ChatSettingsMessengerRailContentProps) {
  return (
    <>
      <ChatSettingsNameControls
        key={settings.activeMessengerThreadId ?? "no-messenger-thread"}
        activeThread={settings.activeMessengerThread}
        activeThreadId={settings.activeMessengerThreadId}
        settingsLabel={settingsLabel}
        onCloseChatSettings={onCloseChatSettings}
        onRenameThread={nav.renameMessengerThread}
      />
      <ChatSettingsMessengerDrawerHost
        actions={actions}
        nav={nav}
        settings={settings}
        settingsLabel={settingsLabel}
      />
    </>
  );
}
