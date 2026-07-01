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
        activeMessengerThread={settings.activeMessengerThread}
        activeMessengerThreadId={settings.activeMessengerThreadId}
        settingsLabel={settingsLabel}
        onCloseChatSettings={onCloseChatSettings}
        onRenameMessengerThread={nav.renameMessengerThread}
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
