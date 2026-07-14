import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { materializePromptPresetThreadChoiceSelections } from "../../../../engine/prompt-presets/prompt-preset-actions";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPresetDrawer } from "./ChatSettingsPresetDrawer";
import { ChatSettingsPresetVariablesDialog } from "./ChatSettingsPresetVariablesDialog";
import type { ChatSettingsRoleplayActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsResourceDrawerModels } from "../lib/chat-settings-resource-drawer-models";
import { useChatSettingsPresetChoiceFlow } from "../hooks/use-chat-settings-preset-choice-flow";
import type { ShoalRailProps } from "../types";

interface ChatSettingsRoleplayResourceSectionProps {
  actions: Pick<ChatSettingsRoleplayActionGroup, "drawers" | "preset" | "resources">;
  activeRoleplayThreadRecord: RoleplayThread | null;
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
  activeRoleplayThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  models,
  promptPresets,
  onCreateCompanion,
  onCreateLorebook,
  onCreatePreset,
}: ChatSettingsRoleplayResourceSectionProps) {
  const selectedPresetId = models.preset.selectedPresetId;
  const presetChoiceFlow = useChatSettingsPresetChoiceFlow({
    threadId: activeRoleplayThreadRecord?.id,
    selectedPresetId,
    promptPresets,
    history: models.preset.presetChoiceSelectionsByPresetId,
    onPresetChange: actions.preset.onPresetChange,
    onPresetConfirm: actions.preset.onPresetConfirm,
  });
  const { dialogPreset, repairNoticeVisible, selectedPreset, selectionsForPreset } =
    presetChoiceFlow;

  function openPresetVariables() {
    if (!selectedPreset) return;
    presetChoiceFlow.openVariables(selectedPreset.id);
  }

  function handlePresetChange(presetId: string) {
    const target = promptPresets.find((preset) => preset.id === presetId.trim()) ?? null;
    if (!target) {
      actions.preset.onPresetChange(presetId);
      return;
    }
    presetChoiceFlow.selectPreset(target);
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
        onPresetChange={handlePresetChange}
        onSecondaryAction={onCreatePreset}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPresetVariablesDialog
        open={!!dialogPreset}
        preset={dialogPreset}
        presetChoiceSelections={
          dialogPreset?.id === selectedPresetId
            ? models.preset.presetChoiceSelections
            : dialogPreset
              ? materializePromptPresetThreadChoiceSelections(
                  dialogPreset,
                  selectionsForPreset(dialogPreset.id),
                )
              : {}
        }
        onClose={presetChoiceFlow.closeVariables}
        onCancel={presetChoiceFlow.closeVariables}
        onPresetConfirm={actions.preset.onPresetConfirm}
      />

      {repairNoticeVisible && (
        <ChatSettingsNotice>Some preset choices were reset to valid defaults.</ChatSettingsNotice>
      )}

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
