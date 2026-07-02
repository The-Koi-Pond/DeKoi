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
  activeThread: boolean;
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
    prompt: {
      activeMessengerThread: activeThread,
      open: activeThread && openDrawers.prompt,
      systemPromptMode: viewModel.systemPromptMode,
    },
  };
}
