import { useState } from "react";
import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPresetDrawer } from "./ChatSettingsPresetDrawer";
import { ChatSettingsPresetVariablesDialog } from "./ChatSettingsPresetVariablesDialog";
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
  const [presetVariablesOpen, setPresetVariablesOpen] = useState(false);
  const selectedPresetId = models.preset.selectedPresetId;
  const selectedPreset = selectedPresetId
    ? (promptPresets.find((preset) => preset.id === selectedPresetId) ?? null)
    : null;

  function openPresetVariables() {
    if (!selectedPreset) return;
    setPresetVariablesOpen(true);
  }

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
        actionDisabled={!selectedPreset}
        actionLabel="Edit"
        fieldLabel="Selected preset"
        secondaryActionLabel="New"
        surfaceLabel="Roleplay"
        title="Prompt Preset"
        onClearMissingPreset={actions.preset.onClearMissingPreset}
        onPresetAction={openPresetVariables}
        onPresetChange={actions.preset.onPresetChange}
        onSecondaryAction={onCreatePreset}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPresetVariablesDialog
        open={presetVariablesOpen}
        preset={selectedPreset}
        presetChoiceSelections={models.preset.presetChoiceSelections}
        onClose={() => setPresetVariablesOpen(false)}
        onPresetChoiceChange={actions.preset.onPresetChoiceChange}
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
