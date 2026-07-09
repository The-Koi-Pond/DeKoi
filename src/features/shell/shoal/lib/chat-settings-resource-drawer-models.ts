import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";
import type { PromptPresetChoiceSelections } from "../../../../engine/contracts/types/prompt-presets";

export interface ChatSettingsCompanionResourceModel {
  activeMessengerThread: boolean;
  missingCompanionCount: number;
  open: boolean;
  selectedCompanionCount: number;
  selectedCompanionIds: string[];
  selectionLabel: string;
  summary: string;
}

export interface ChatSettingsPresetResourceModel {
  activeThread: boolean;
  missingPresetId: string | null;
  open: boolean;
  presetChoiceSelections: PromptPresetChoiceSelections;
  selectedPresetId: string | null;
  summary: string;
}

export interface ChatSettingsLorebookResourceModel {
  activeMessengerThread: boolean;
  missingLorebookCount: number;
  open: boolean;
  selectedLorebookIds: string[];
  summary: string;
}

interface ChatSettingsResourceDrawerModelsInput {
  activeThread: boolean;
  openDrawers: Pick<Record<ChatSettingsDrawerId, boolean>, "companions" | "lorebooks" | "preset">;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsResourceDrawerModels {
  companion: ChatSettingsCompanionResourceModel;
  lorebook: ChatSettingsLorebookResourceModel;
  preset: ChatSettingsPresetResourceModel;
}

export function getChatSettingsResourceDrawerModels({
  activeThread,
  openDrawers,
  viewModel,
}: ChatSettingsResourceDrawerModelsInput): ChatSettingsResourceDrawerModels {
  return {
    companion: {
      activeMessengerThread: activeThread,
      missingCompanionCount: viewModel.missingCompanionCount,
      open: activeThread && openDrawers.companions,
      selectedCompanionCount: viewModel.selectedCompanionCount,
      selectedCompanionIds: viewModel.selectedCompanionIds,
      selectionLabel: viewModel.companionSelectionLabel,
      summary: viewModel.companionDrawerSummary,
    },
    lorebook: {
      activeMessengerThread: activeThread,
      missingLorebookCount: viewModel.missingLorebookCount,
      open: activeThread && openDrawers.lorebooks,
      selectedLorebookIds: viewModel.selectedLorebookIds,
      summary: viewModel.lorebookDrawerSummary,
    },
    preset: {
      activeThread,
      missingPresetId: viewModel.missingPresetId,
      open: activeThread && openDrawers.preset,
      presetChoiceSelections: viewModel.presetChoiceSelections,
      selectedPresetId: viewModel.selectedPresetId,
      summary: viewModel.presetDrawerSummary,
    },
  };
}
