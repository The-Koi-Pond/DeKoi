import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsCompanionResourceModel {
  activeMessengerThread: boolean;
  missingCompanionCount: number;
  open: boolean;
  selectedCompanionCount: number;
  selectedCompanionIds: string[];
  selectionLabel: string;
  summary: string;
}

export interface ChatSettingsPromptResourceModel {
  activeMessengerThread: boolean;
  open: boolean;
  systemPromptMode: ChatSettingsViewModel["systemPromptMode"];
}

export interface ChatSettingsLorebookResourceModel {
  activeMessengerThread: boolean;
  missingLorebookCount: number;
  open: boolean;
  selectedLorebookIds: string[];
  summary: string;
}

interface ChatSettingsResourceDrawerModelsInput {
  activeMessengerThread: boolean;
  openDrawers: Pick<
    Record<ChatSettingsDrawerId, boolean>,
    "companions" | "lorebooks" | "prompt"
  >;
  viewModel: ChatSettingsViewModel;
}

export interface ChatSettingsResourceDrawerModels {
  companion: ChatSettingsCompanionResourceModel;
  lorebook: ChatSettingsLorebookResourceModel;
  prompt: ChatSettingsPromptResourceModel;
}

export function getChatSettingsResourceDrawerModels({
  activeMessengerThread,
  openDrawers,
  viewModel,
}: ChatSettingsResourceDrawerModelsInput): ChatSettingsResourceDrawerModels {
  return {
    companion: {
      activeMessengerThread,
      missingCompanionCount: viewModel.missingCompanionCount,
      open: activeMessengerThread && openDrawers.companions,
      selectedCompanionCount: viewModel.selectedCompanionCount,
      selectedCompanionIds: viewModel.selectedCompanionIds,
      selectionLabel: viewModel.companionSelectionLabel,
      summary: viewModel.companionDrawerSummary,
    },
    lorebook: {
      activeMessengerThread,
      missingLorebookCount: viewModel.missingLorebookCount,
      open: activeMessengerThread && openDrawers.lorebooks,
      selectedLorebookIds: viewModel.selectedLorebookIds,
      summary: viewModel.lorebookDrawerSummary,
    },
    prompt: {
      activeMessengerThread,
      open: activeMessengerThread && openDrawers.prompt,
      systemPromptMode: viewModel.systemPromptMode,
    },
  };
}
