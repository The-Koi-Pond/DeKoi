import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import { resolvePromptPresetMessengerPrompt } from "../../../../engine/contracts/types/prompt-presets";
import { ChatSettingsCompanionResourceDrawer } from "./ChatSettingsCompanionResourceDrawer";
import { ChatSettingsLorebookResourceDrawer } from "./ChatSettingsLorebookResourceDrawer";
import { ChatSettingsPresetDrawer } from "./ChatSettingsPresetDrawer";
import { ChatSettingsPromptEditor } from "./ChatSettingsPromptEditor";
import { useChatSettingsPromptEditor } from "../hooks/use-chat-settings-prompt-editor";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsResourceDrawerModels } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerResourceSectionProps {
  actions: Pick<ChatSettingsMessengerActionGroup, "drawers" | "preset" | "prompt" | "resources">;
  activeMessengerThreadId: string | null;
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
  activeMessengerThreadId,
  activeMessengerThreadRecord,
  characters,
  companionSelectorOpen,
  lorebooks,
  models,
  promptPresets,
  onCreateCompanion,
  onCreateLorebook,
}: ChatSettingsMessengerResourceSectionProps) {
  const selectedPromptSource = activeMessengerThreadRecord?.presetId
    ? resolvePromptPresetMessengerPrompt(
        promptPresets.find((preset) => preset.id === activeMessengerThreadRecord.presetId),
      )
    : null;
  const {
    activePromptEditor,
    closePromptEditor,
    openPromptEditor,
    savePromptEditor,
    updatePromptEditorValue,
  } = useChatSettingsPromptEditor({
    activeMessengerThread: activeMessengerThreadRecord,
    activeMessengerThreadId,
    sourcePrompt: selectedPromptSource,
    onSaveCustomPrompt: actions.prompt.onSaveCustomPrompt,
  });

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
        actionLabel="Edit"
        fieldLabel="Prompt Source"
        surfaceLabel="Messenger"
        title="Prompt Preset"
        onClearMissingPreset={actions.preset.onClearMissingPreset}
        onPresetAction={openPromptEditor}
        onPresetChange={actions.preset.onPresetChange}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPromptEditor
        open={activePromptEditor.open && !!activeMessengerThreadRecord}
        value={activePromptEditor.value}
        onClose={closePromptEditor}
        onSave={savePromptEditor}
        onValueChange={updatePromptEditorValue}
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
