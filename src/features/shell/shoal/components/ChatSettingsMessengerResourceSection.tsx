import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPromptControls } from "./ChatSettingsPromptControls";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsResourceDrawerModels } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceSectionProps {
  actions: Pick<
    ChatSettingsMessengerActionGroup,
    "drawers" | "prompt" | "resources"
  >;
  activeMessengerThreadId: string | null;
  activeMessengerThreadRecord: MessengerThread | null;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  models: ChatSettingsResourceDrawerModels;
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
}

export function ChatSettingsMessengerResourceSection({
  actions,
  activeMessengerThreadId,
  activeMessengerThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  models,
  onCreateCompanion,
  onCreateLorebook,
}: ChatSettingsMessengerResourceSectionProps) {
  return (
    <>
      <ChatSettingsCompanionResourceDrawer
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        model={models.companion}
        onClearMissingCompanions={actions.resources.clearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={actions.resources.onSelectorOpenChange}
        onToggle={actions.drawers.onToggle}
        onToggleCompanion={actions.resources.onToggleCompanion}
      />

      <ChatSettingsPromptControls
        key={activeMessengerThreadId ?? "no-messenger-thread"}
        activeMessengerThreadRecord={activeMessengerThreadRecord}
        activeMessengerThreadId={activeMessengerThreadId}
        model={models.prompt}
        onSaveCustomPrompt={actions.prompt.onSaveCustomPrompt}
        onSystemPromptModeChange={actions.prompt.onSystemPromptModeChange}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsLorebookResourceDrawer
        lorebooks={lorebooks}
        model={models.lorebook}
        onClearMissingLorebooks={actions.resources.clearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggle={actions.drawers.onToggle}
        onToggleLorebook={actions.resources.onToggleLorebook}
      />
    </>
  );
}
