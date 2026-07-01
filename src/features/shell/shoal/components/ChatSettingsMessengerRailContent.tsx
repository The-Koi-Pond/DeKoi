import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";
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
      <ChatSettingsMessengerDrawers
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        appSettings={nav.appSettings}
        characters={nav.characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={nav.lorebooks}
        openDrawers={openDrawers}
        personas={nav.personas}
        settingsLabel={settingsLabel}
        viewModel={chatSettingsViewModel}
        onClearMissingCompanions={onClearMissingCompanions}
        onClearMissingLorebooks={onClearMissingLorebooks}
        onConnectionChange={onConnectionChange}
        onCreateCompanion={() =>
          nav.setView({ kind: "companions", mode: "new" })
        }
        onCreateConnection={() =>
          nav.setView({ kind: "connections", mode: "new" })
        }
        onCreateLorebook={() =>
          nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
        }
        onCreateMessengerThread={nav.createMessengerThread}
        onPersonaChange={onPersonaChange}
        onResolveMissingConnection={onResolveMissingConnection}
        onSaveCustomPrompt={onSaveCustomPrompt}
        onSelectorOpenChange={onSelectorOpenChange}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
        onToggleCompanion={onToggleCompanion}
        onToggleLorebook={onToggleLorebook}
        onUpdateAppSettings={nav.updateAppSettings}
      />
    </>
  );
}
