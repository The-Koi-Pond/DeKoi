import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsCompanionResourceModel {
  missingCompanionCount: number;
  open: boolean;
  selectedCompanionCount: number;
  selectedCompanionIds: string[];
  selectionLabel: string;
  summary: string;
}

export interface ChatSettingsPromptResourceModel {
  open: boolean;
  systemPromptMode: ChatSettingsViewModel["systemPromptMode"];
}

export interface ChatSettingsLorebookResourceModel {
  missingLorebookCount: number;
  open: boolean;
  selectedLorebookIds: string[];
  summary: string;
}

interface ChatSettingsResourceDrawerModelsInput {
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsResourceDrawerModels {
  companion: ChatSettingsCompanionResourceModel;
  lorebook: ChatSettingsLorebookResourceModel;
  prompt: ChatSettingsPromptResourceModel;
}

export function getChatSettingsResourceDrawerModels({
  openDrawers,
  viewModel,
}: ChatSettingsResourceDrawerModelsInput): ChatSettingsResourceDrawerModels {
  return {
    companion: {
      missingCompanionCount: viewModel.missingCompanionCount,
      open: openDrawers.companions,
      selectedCompanionCount: viewModel.selectedCompanionCount,
      selectedCompanionIds: viewModel.selectedCompanionIds,
      selectionLabel: viewModel.companionSelectionLabel,
      summary: viewModel.companionDrawerSummary,
    },
    lorebook: {
      missingLorebookCount: viewModel.missingLorebookCount,
      open: openDrawers.lorebooks,
      selectedLorebookIds: viewModel.selectedLorebookIds,
      summary: viewModel.lorebookDrawerSummary,
    },
    prompt: {
      open: openDrawers.prompt,
      systemPromptMode: viewModel.systemPromptMode,
    },
  };
}
