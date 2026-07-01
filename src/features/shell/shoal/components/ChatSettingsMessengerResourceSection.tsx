import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsPromptControls } from "./ChatSettingsPromptControls";
import {
  ChatSettingsCompanionResourceDrawer,
  ChatSettingsLorebookResourceDrawer,
} from "./ChatSettingsResourceDrawers";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceSectionProps {
  activeMessengerThread: boolean;
  activeMessengerThreadId: string | null;
  activeMessengerThreadRecord: MessengerThread | null;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
  onClearMissingCompanions: () => void;
  onClearMissingLorebooks: () => void;
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSelectorOpenChange: (open: boolean) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function ChatSettingsMessengerResourceSection({
  activeMessengerThread,
  activeMessengerThreadId,
  activeMessengerThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  openDrawers,
  viewModel,
  onClearMissingCompanions,
  onClearMissingLorebooks,
  onCreateCompanion,
  onCreateLorebook,
  onSaveCustomPrompt,
  onSelectorOpenChange,
  onSystemPromptModeChange,
  onToggle,
  onToggleCompanion,
  onToggleLorebook,
}: ChatSettingsMessengerResourceSectionProps) {
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

      <ChatSettingsPromptControls
        key={activeMessengerThreadId ?? "no-messenger-thread"}
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadRecord={activeMessengerThreadRecord}
        activeMessengerThreadId={activeMessengerThreadId}
        open={openDrawers.prompt}
        systemPromptMode={viewModel.systemPromptMode}
        onSaveCustomPrompt={onSaveCustomPrompt}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
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
