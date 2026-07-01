import { ChatSettingsRoleplayDrawers } from "./ChatSettingsRoleplayDrawers";
import type {
  ChatSettingsRoleplayActionGroup,
  ChatSettingsRoleplaySettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRoleplayDrawerHostProps {
  actions: ChatSettingsRoleplayActionGroup;
  nav: ShoalRailProps["nav"];
  settings: ChatSettingsRoleplaySettings;
  settingsLabel: string;
}

export function ChatSettingsRoleplayDrawerHost({
  actions,
  nav,
  settings,
  settingsLabel,
}: ChatSettingsRoleplayDrawerHostProps) {
  return (
    <ChatSettingsRoleplayDrawers
      actions={actions}
      catalog={{
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
      }}
      navigation={{
        onCreateCompanion: () =>
          nav.setView({ kind: "companions", mode: "new" }),
        onCreateConnection: () =>
          nav.setView({ kind: "connections", mode: "new" }),
        onCreateLorebook: () =>
          nav.setView({ kind: "lorebooks", mode: "new-lorebook" }),
        onCreateRoleplayThread: nav.createRoleplayThread,
        onUpdateAppSettings: nav.updateAppSettings,
      }}
      settings={settings}
      settingsLabel={settingsLabel}
    />
  );
}
