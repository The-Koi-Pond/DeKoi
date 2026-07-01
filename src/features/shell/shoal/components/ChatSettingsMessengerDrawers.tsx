import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsIdentityDrawers } from "./ChatSettingsIdentityDrawers";
import { ChatSettingsMessengerResourceSection } from "./ChatSettingsMessengerResourceSection";
import { ChatSettingsNoActiveMessengerNotice } from "./ChatSettingsNoActiveMessengerNotice";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import { getChatSettingsMessengerDrawerModels } from "../lib/chat-settings-messenger-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerDrawersProps {
  actions: ChatSettingsMessengerActionGroup;
  catalog: ChatSettingsMessengerDrawerCatalog;
  navigation: ChatSettingsMessengerDrawerNavigation;
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
}

interface ChatSettingsMessengerDrawerCatalog {
  appSettings: ShoalRailProps["nav"]["appSettings"];
  characters: ShoalRailProps["nav"]["characters"];
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  personas: ShoalRailProps["nav"]["personas"];
}

interface ChatSettingsMessengerDrawerNavigation {
  onCreateCompanion: () => void;
  onCreateConnection: () => void;
  onCreateLorebook: () => void;
  onCreateMessengerThread: () => void;
  onUpdateAppSettings: ShoalRailProps["nav"]["updateAppSettings"];
}

export function ChatSettingsMessengerDrawers({
  actions,
  catalog,
  navigation,
  settings,
  settingsLabel,
}: ChatSettingsMessengerDrawersProps) {
  const { appSettings, characters, lorebooks, personas } = catalog;
  const {
    onCreateCompanion,
    onCreateConnection,
    onCreateLorebook,
    onCreateMessengerThread,
    onUpdateAppSettings,
  } = navigation;
  const {
    activeMessengerThread,
    activeMessengerThreadId,
    advanced,
    chatSettingsActive,
    companionSelectorOpen,
    identity,
    resources,
  } = getChatSettingsMessengerDrawerModels({
    appSettings,
    settings,
    settingsLabel,
  });

  return (
    <div className="shoal-list chat-settings-list">
      {!activeMessengerThread && (
        <ChatSettingsNoActiveMessengerNotice
          onCreateMessengerThread={onCreateMessengerThread}
        />
      )}
      <ChatSettingsIdentityDrawers
        actions={actions}
        activeMessengerThread={chatSettingsActive}
        models={identity}
        personas={personas}
        onCreateConnection={onCreateConnection}
      />

      <ChatSettingsMessengerResourceSection
        actions={actions}
        activeMessengerThread={chatSettingsActive}
        activeMessengerThreadRecord={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={lorebooks}
        models={resources}
        onCreateCompanion={onCreateCompanion}
        onCreateLorebook={onCreateLorebook}
      />

      <ChatSettingsAdvancedDrawer
        model={advanced}
        onToggle={actions.drawers.onToggle}
        onUpdateAppSettings={onUpdateAppSettings}
      />
    </div>
  );
}
