import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsMessengerDrawerHost } from "./ChatSettingsMessengerDrawerHost";
import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerRailContentProps {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  chatSettingsViewModel: ChatSettingsViewModel;
  companionSelectorOpen: boolean;
  nav: ShoalRailProps["nav"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  settingsLabel: string;
  onClearMissingCompanions: () => void;
  onClearMissingLorebooks: () => void;
  onCloseChatSettings: () => void;
  onConnectionChange: (connectionId: string) => void;
  onPersonaChange: (personaId: string) => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSelectorOpenChange: (open: boolean) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsMessengerRailContent({
  activeMessengerThread,
  activeMessengerThreadId,
  chatSettingsViewModel,
  companionSelectorOpen,
  nav,
  openDrawers,
  settingsLabel,
  onClearMissingCompanions,
  onClearMissingLorebooks,
  onCloseChatSettings,
  onConnectionChange,
  onPersonaChange,
  onResolveMissingConnection,
  onSaveCustomPrompt,
  onSelectorOpenChange,
  onSystemPromptModeChange,
  onToggle,
  onToggleCompanion,
  onToggleLorebook,
}: ChatSettingsMessengerRailContentProps) {
  return (
    <>
      <ChatSettingsNameControls
        key={activeMessengerThreadId ?? "no-messenger-thread"}
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        settingsLabel={settingsLabel}
        onCloseChatSettings={onCloseChatSettings}
        onRenameMessengerThread={nav.renameMessengerThread}
      />
      <ChatSettingsMessengerDrawerHost
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        chatSettingsViewModel={chatSettingsViewModel}
        companionSelectorOpen={companionSelectorOpen}
        nav={nav}
        openDrawers={openDrawers}
        settingsLabel={settingsLabel}
        onClearMissingCompanions={onClearMissingCompanions}
        onClearMissingLorebooks={onClearMissingLorebooks}
        onConnectionChange={onConnectionChange}
        onPersonaChange={onPersonaChange}
        onResolveMissingConnection={onResolveMissingConnection}
        onSaveCustomPrompt={onSaveCustomPrompt}
        onSelectorOpenChange={onSelectorOpenChange}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
        onToggleCompanion={onToggleCompanion}
        onToggleLorebook={onToggleLorebook}
      />
    </>
  );
}
