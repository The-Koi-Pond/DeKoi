import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsIdentityDrawers } from "./ChatSettingsIdentityDrawers";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsRoleplayResourceSection } from "./ChatSettingsRoleplayResourceSection";
import type {
  ChatSettingsRoleplayActionGroup,
  ChatSettingsRoleplaySettings,
} from "../lib/chat-settings-controller-groups";
import { getChatSettingsRoleplayDrawerModels } from "../lib/chat-settings-roleplay-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRoleplayDrawersProps {
  actions: ChatSettingsRoleplayActionGroup;
  catalog: ChatSettingsRoleplayDrawerCatalog;
  navigation: ChatSettingsRoleplayDrawerNavigation;
  settings: ChatSettingsRoleplaySettings;
  settingsLabel: string;
}

interface ChatSettingsRoleplayDrawerCatalog {
  appSettings: ShoalRailProps["nav"]["appSettings"];
  characters: ShoalRailProps["nav"]["characters"];
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  personas: ShoalRailProps["nav"]["personas"];
  promptPresets: ShoalRailProps["nav"]["promptPresets"];
}

interface ChatSettingsRoleplayDrawerNavigation {
  onCreateCompanion: () => void;
  onCreateConnection: () => void;
  onCreateLorebook: () => void;
  onCreatePreset: () => void;
  onCreateRoleplayThread: () => void;
  onUpdateAppSettings: ShoalRailProps["nav"]["updateAppSettings"];
}

export function ChatSettingsRoleplayDrawers({
  actions,
  catalog,
  navigation,
  settings,
  settingsLabel,
}: ChatSettingsRoleplayDrawersProps) {
  const { appSettings, characters, lorebooks, personas, promptPresets } = catalog;
  const {
    onCreateCompanion,
    onCreateConnection,
    onCreateLorebook,
    onCreatePreset,
    onCreateRoleplayThread,
    onUpdateAppSettings,
  } = navigation;
  const { activeRoleplayThread, advanced, companionSelectorOpen, identity, resources } =
    getChatSettingsRoleplayDrawerModels({
      appSettings,
      settings,
      settingsLabel,
    });

  return (
    <div className="shoal-list chat-settings-list">
      {!activeRoleplayThread && (
        <ChatSettingsNotice actionLabel="New Roleplay" onAction={onCreateRoleplayThread}>
          Open or create a Roleplay thread to edit connection, persona, companions, and lore
          settings.
        </ChatSettingsNotice>
      )}
      <ChatSettingsIdentityDrawers
        actions={actions}
        models={identity}
        personas={personas}
        surfaceLabel="Roleplay"
        onCreateConnection={onCreateConnection}
      />

      <ChatSettingsRoleplayResourceSection
        actions={actions}
        activeRoleplayThreadRecord={activeRoleplayThread}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={lorebooks}
        models={resources}
        promptPresets={promptPresets}
        onCreateCompanion={onCreateCompanion}
        onCreateLorebook={onCreateLorebook}
        onCreatePreset={onCreatePreset}
      />

      <ChatSettingsAdvancedDrawer
        model={advanced}
        onToggle={actions.drawers.onToggle}
        onUpdateAppSettings={onUpdateAppSettings}
      />
    </div>
  );
}
