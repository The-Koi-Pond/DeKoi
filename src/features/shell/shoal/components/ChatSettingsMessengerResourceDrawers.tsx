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

type ChatSettingsMessengerCompanionResourceDrawerProps = Omit<
  ChatSettingsMessengerResourceDrawersProps,
  | "lorebooks"
  | "onClearMissingLorebooks"
  | "onCreateLorebook"
  | "onToggleLorebook"
>;

export function ChatSettingsMessengerCompanionResourceDrawer({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  openDrawers,
  viewModel,
  onClearMissingCompanions,
  onCreateCompanion,
  onSelectorOpenChange,
  onToggle,
  onToggleCompanion,
}: ChatSettingsMessengerCompanionResourceDrawerProps) {
  return (
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
  );
}

type ChatSettingsMessengerLorebookResourceDrawerProps = Omit<
  ChatSettingsMessengerResourceDrawersProps,
  | "characters"
  | "companionSelectorOpen"
  | "onClearMissingCompanions"
  | "onCreateCompanion"
  | "onSelectorOpenChange"
  | "onToggleCompanion"
>;

export function ChatSettingsMessengerLorebookResourceDrawer({
  activeMessengerThread,
  lorebooks,
  openDrawers,
  viewModel,
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggle,
  onToggleLorebook,
}: ChatSettingsMessengerLorebookResourceDrawerProps) {
  return (
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
  );
}
