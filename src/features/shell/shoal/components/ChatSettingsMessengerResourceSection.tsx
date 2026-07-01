import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import { ChatSettingsPromptControls } from "./ChatSettingsPromptControls";
import {
  ChatSettingsCompanionResourceDrawer,
  ChatSettingsLorebookResourceDrawer,
} from "./ChatSettingsResourceDrawers";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceSectionProps {
  actions: Pick<
    ChatSettingsMessengerActionGroup,
    "drawers" | "prompt" | "resources"
  >;
  activeMessengerThread: boolean;
  activeMessengerThreadId: string | null;
  activeMessengerThreadRecord: MessengerThread | null;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
}

export function ChatSettingsMessengerResourceSection({
  actions,
  activeMessengerThread,
  activeMessengerThreadId,
  activeMessengerThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  openDrawers,
  viewModel,
  onCreateCompanion,
  onCreateLorebook,
}: ChatSettingsMessengerResourceSectionProps) {
  return (
    <>
      <ChatSettingsCompanionResourceDrawer
        activeMessengerThread={activeMessengerThread}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingCompanions={actions.resources.clearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={actions.resources.onSelectorOpenChange}
        onToggle={actions.drawers.onToggle}
        onToggleCompanion={actions.resources.onToggleCompanion}
      />

      <ChatSettingsPromptControls
        key={activeMessengerThreadId ?? "no-messenger-thread"}
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadRecord={activeMessengerThreadRecord}
        activeMessengerThreadId={activeMessengerThreadId}
        open={openDrawers.prompt}
        systemPromptMode={viewModel.systemPromptMode}
        onSaveCustomPrompt={actions.prompt.onSaveCustomPrompt}
        onSystemPromptModeChange={actions.prompt.onSystemPromptModeChange}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsLorebookResourceDrawer
        activeMessengerThread={activeMessengerThread}
        lorebooks={lorebooks}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingLorebooks={actions.resources.clearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggle={actions.drawers.onToggle}
        onToggleLorebook={actions.resources.onToggleLorebook}
      />
    </>
  );
}
