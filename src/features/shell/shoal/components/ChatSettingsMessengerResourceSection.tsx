import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsPresetVariablesDialog } from "./ChatSettingsPresetVariablesDialog";
import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPresetDrawer } from "./ChatSettingsPresetDrawer";
import { useChatSettingsPresetChoiceFlow } from "../hooks/use-chat-settings-preset-choice-flow";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsResourceDrawerModels } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceSectionProps {
  actions: Pick<ChatSettingsMessengerActionGroup, "drawers" | "preset" | "resources">;
  activeMessengerThreadRecord: MessengerThread | null;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  models: ChatSettingsResourceDrawerModels;
  promptPresets: ShoalRailProps["nav"]["promptPresets"];
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
}

export function ChatSettingsMessengerResourceSection({
  actions,
  activeMessengerThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  models,
  promptPresets,
  onCreateCompanion,
  onCreateLorebook,
}: ChatSettingsMessengerResourceSectionProps) {
  const {
    selectedPreset: activePreset,
    dialogPreset: variablesPreset,
    repairNoticeVisible,
    selectionsForPreset,
    openVariables,
    closeVariables,
    selectPreset,
  } = useChatSettingsPresetChoiceFlow({
    threadId: activeMessengerThreadRecord?.id,
    selectedPresetId: activeMessengerThreadRecord?.presetId,
    promptPresets,
    history: activeMessengerThreadRecord?.presetChoiceSelectionsByPresetId,
    onPresetChange: actions.preset.onPresetChange,
    onPresetConfirm: actions.preset.onPresetConfirm,
  });

  function handlePresetChange(presetId: string) {
    const preset = promptPresets.find((candidate) => candidate.id === presetId);
    if (!preset) {
      actions.preset.onPresetChange(presetId);
      return;
    }
    selectPreset(preset);
  }
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

      <ChatSettingsPresetDrawer
        model={models.preset}
        promptPresets={promptPresets}
        actionDisabled={!activeMessengerThreadRecord}
        fieldLabel="Prompt Source"
        surfaceLabel="Messenger"
        title="Prompt Preset"
        onClearMissingPreset={actions.preset.onClearMissingPreset}
        onPresetChange={handlePresetChange}
        secondaryActionLabel="Variables"
        secondaryActionDisabled={!activePreset}
        onSecondaryAction={() => activePreset && openVariables(activePreset.id)}
        onToggle={actions.drawers.onToggle}
      />

      {repairNoticeVisible && (
        <ChatSettingsNotice>Some preset choices were reset to valid defaults.</ChatSettingsNotice>
      )}

      <ChatSettingsPresetVariablesDialog
        open={!!variablesPreset}
        preset={variablesPreset}
        presetChoiceSelections={variablesPreset ? selectionsForPreset(variablesPreset.id) : {}}
        onClose={closeVariables}
        onCancel={closeVariables}
        onPresetConfirm={actions.preset.onPresetConfirm}
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
