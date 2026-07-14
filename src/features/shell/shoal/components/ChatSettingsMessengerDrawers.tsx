import { ChatSettingsIdentityDrawers } from "./ChatSettingsIdentityDrawers";
import { ChatSettingsMessengerResourceSection } from "./ChatSettingsMessengerResourceSection";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
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
}

interface ChatSettingsMessengerDrawerCatalog {
  characters: ShoalRailProps["nav"]["characters"];
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  personas: ShoalRailProps["nav"]["personas"];
  promptPresets: ShoalRailProps["nav"]["promptPresets"];
}

interface ChatSettingsMessengerDrawerNavigation {
  onCreateCompanion: () => void;
  onCreateConnection: () => void;
  onCreateLorebook: () => void;
  onCreateMessengerThread: () => void;
}

export function ChatSettingsMessengerDrawers({
  actions,
  catalog,
  navigation,
  settings,
}: ChatSettingsMessengerDrawersProps) {
  const { characters, lorebooks, personas, promptPresets } = catalog;
  const { onCreateCompanion, onCreateConnection, onCreateLorebook, onCreateMessengerThread } =
    navigation;
  const { activeMessengerThread, companionSelectorOpen, identity, resources } =
    getChatSettingsMessengerDrawerModels({ settings });

  return (
    <div className="shoal-list chat-settings-list">
      {!activeMessengerThread && (
        <ChatSettingsNotice actionLabel="New Messenger" onAction={onCreateMessengerThread}>
          Open or create a Messenger thread to edit connection, persona, companion, and lore
          settings.
        </ChatSettingsNotice>
      )}
      <ChatSettingsIdentityDrawers
        actions={actions}
        models={identity}
        personas={personas}
        onCreateConnection={onCreateConnection}
      />

      <ChatSettingsMessengerResourceSection
        actions={actions}
        activeMessengerThreadRecord={activeMessengerThread}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={lorebooks}
        models={resources}
        promptPresets={promptPresets}
        onCreateCompanion={onCreateCompanion}
        onCreateLorebook={onCreateLorebook}
      />
    </div>
  );
}
