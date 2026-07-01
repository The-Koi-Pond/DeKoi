import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsMessengerSettings {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  chatSettingsViewModel: ChatSettingsViewModel;
  companionSelectorOpen: boolean;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
}

export interface ChatSettingsMessengerDrawerActions {
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export interface ChatSettingsMessengerIdentityActions {
  onConnectionChange: (connectionId: string) => void;
  onPersonaChange: (personaId: string) => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export interface ChatSettingsMessengerResourceActions {
  clearMissingCompanions: () => void;
  clearMissingLorebooks: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export interface ChatSettingsMessengerPromptActions {
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
}

export interface ChatSettingsMessengerActionGroup {
  drawers: ChatSettingsMessengerDrawerActions;
  identity: ChatSettingsMessengerIdentityActions;
  prompt: ChatSettingsMessengerPromptActions;
  resources: ChatSettingsMessengerResourceActions;
}
