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
}

export function ChatSettingsMessengerDrawerHost({
  actions,
  nav,
  settings,
}: ChatSettingsMessengerDrawerHostProps) {
  return (
    <ChatSettingsMessengerDrawers
      actions={actions}
      catalog={{
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
      }}
      navigation={{
        onCreateCompanion: () => nav.setView({ kind: "companions", mode: "new" }),
        onCreateConnection: () => nav.setView({ kind: "connections", mode: "new" }),
        onCreateLorebook: () => nav.setView({ kind: "lorebooks", mode: "new-lorebook" }),
        onCreateMessengerThread: nav.createMessengerThread,
      }}
      settings={settings}
    />
  );
}
