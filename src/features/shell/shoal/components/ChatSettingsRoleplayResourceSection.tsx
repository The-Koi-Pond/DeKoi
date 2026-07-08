import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPresetDrawer } from "./ChatSettingsPresetDrawer";
import type { ChatSettingsRoleplayActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsResourceDrawerModels } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRoleplayResourceSectionProps {
  actions: Pick<ChatSettingsRoleplayActionGroup, "drawers" | "preset" | "resources">;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  models: ChatSettingsResourceDrawerModels;
  promptPresets: ShoalRailProps["nav"]["promptPresets"];
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
  onCreatePreset: () => void;
}

export function ChatSettingsRoleplayResourceSection({
  actions,
  characters,
  companionSelectorOpen,
  lorebooks,
  models,
  promptPresets,
  onCreateCompanion,
  onCreateLorebook,
  onCreatePreset,
}: ChatSettingsRoleplayResourceSectionProps) {
  return (
    <>
      <ChatSettingsCompanionResourceDrawer
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        model={models.companion}
        surfaceLabel="Roleplay"
        onClearMissingCompanions={actions.resources.clearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={actions.resources.onSelectorOpenChange}
        onToggle={actions.drawers.onToggle}
        onToggleCompanion={actions.resources.onToggleCompanion}
      />

      <ChatSettingsPresetDrawer
        model={models.preset}
        promptPresets={promptPresets}
        surfaceLabel="Roleplay"
        onClearMissingPreset={actions.preset.onClearMissingPreset}
        onCreatePreset={onCreatePreset}
        onPresetChange={actions.preset.onPresetChange}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsLorebookResourceDrawer
        lorebooks={lorebooks}
        model={models.lorebook}
        surfaceLabel="Roleplay"
        onClearMissingLorebooks={actions.resources.clearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggle={actions.drawers.onToggle}
        onToggleLorebook={actions.resources.onToggleLorebook}
      />
    </>
  );
}
