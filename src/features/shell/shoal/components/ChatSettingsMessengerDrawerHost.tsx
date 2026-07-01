import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerDrawerHostProps {
  actions: ChatSettingsMessengerActionGroup;
  nav: ShoalRailProps["nav"];
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
}

export function ChatSettingsMessengerDrawerHost({
  actions,
  nav,
  settings,
  settingsLabel,
}: ChatSettingsMessengerDrawerHostProps) {
  return (
    <ChatSettingsMessengerDrawers
      actions={actions}
      appSettings={nav.appSettings}
      characters={nav.characters}
      lorebooks={nav.lorebooks}
      personas={nav.personas}
      settings={settings}
      settingsLabel={settingsLabel}
      onCreateCompanion={() => nav.setView({ kind: "companions", mode: "new" })}
      onCreateConnection={() =>
        nav.setView({ kind: "connections", mode: "new" })
      }
      onCreateLorebook={() =>
        nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
      }
      onCreateMessengerThread={nav.createMessengerThread}
      onUpdateAppSettings={nav.updateAppSettings}
    />
  );
}
