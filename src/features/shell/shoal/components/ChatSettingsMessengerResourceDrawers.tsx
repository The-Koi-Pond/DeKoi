import {
  ChatSettingsCompanionResourceDrawer,
  ChatSettingsLorebookResourceDrawer,
} from "./ChatSettingsResourceDrawers";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceDrawersProps {
  activeMessengerThread: boolean;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
  onClearMissingCompanions: () => void;
  onClearMissingLorebooks: () => void;
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsMessengerResourceDrawers({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  lorebooks,
  openDrawers,
  viewModel,
  onClearMissingCompanions,
  onClearMissingLorebooks,
  onCreateCompanion,
  onCreateLorebook,
  onSelectorOpenChange,
  onToggle,
  onToggleCompanion,
  onToggleLorebook,
}: ChatSettingsMessengerResourceDrawersProps) {
  return (
    <>
      <ChatSettingsCompanionResourceDrawer
        activeMessengerThread={activeMessengerThread}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingCompanions={onClearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={onSelectorOpenChange}
        onToggle={onToggle}
        onToggleCompanion={onToggleCompanion}
      />

      <ChatSettingsLorebookResourceDrawer
        activeMessengerThread={activeMessengerThread}
        lorebooks={lorebooks}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingLorebooks={onClearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggle={onToggle}
        onToggleLorebook={onToggleLorebook}
      />
    </>
  );
}
