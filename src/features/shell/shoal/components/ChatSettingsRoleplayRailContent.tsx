import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
import { ChatSettingsRoleplayDrawerHost } from "./ChatSettingsRoleplayDrawerHost";
import type {
  ChatSettingsRoleplayActionGroup,
  ChatSettingsRoleplaySettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRoleplayRailContentProps {
  actions: ChatSettingsRoleplayActionGroup;
  nav: ShoalRailProps["nav"];
  settings: ChatSettingsRoleplaySettings;
  settingsLabel: string;
  onCloseChatSettings: () => void;
}

export function ChatSettingsRoleplayRailContent({
  actions,
  nav,
  settings,
  settingsLabel,
  onCloseChatSettings,
}: ChatSettingsRoleplayRailContentProps) {
  return (
    <>
      <ChatSettingsNameControls
        key={settings.activeRoleplayThreadId ?? "no-roleplay-thread"}
        activeThread={settings.activeRoleplayThread}
        activeThreadId={settings.activeRoleplayThreadId}
        settingsLabel={settingsLabel}
        onCloseChatSettings={onCloseChatSettings}
        onRenameThread={nav.renameRoleplayThread}
      />
      <ChatSettingsRoleplayDrawerHost
        actions={actions}
        nav={nav}
        settings={settings}
        settingsLabel={settingsLabel}
      />
    </>
  );
}
