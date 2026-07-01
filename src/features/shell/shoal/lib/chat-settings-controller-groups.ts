import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type { ChatSettingsDrawerId } from "./chat-settings-drawers";
import type { ChatSettingsViewModel } from "./chat-settings-view-model";

export interface ChatSettingsMessengerSettings {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  chatSettingsViewModel: ChatSettingsViewModel;
  companionSelectorOpen: boolean;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
}

export interface ChatSettingsDrawerActions {
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export interface ChatSettingsIdentityActions {
  onConnectionChange: (connectionId: string) => void;
  onPersonaChange: (personaId: string) => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export interface ChatSettingsThreadResourceActions {
  clearMissingCompanions: () => void;
  clearMissingLorebooks: () => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export interface ChatSettingsResourceActions
  extends ChatSettingsThreadResourceActions {
  onSelectorOpenChange: (open: boolean) => void;
}

export interface ChatSettingsPromptActions {
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
}

export type ChatSettingsMessengerDrawerActions = ChatSettingsDrawerActions;
export type ChatSettingsMessengerIdentityActions = ChatSettingsIdentityActions;
export type ChatSettingsMessengerThreadResourceActions =
  ChatSettingsThreadResourceActions;
export type ChatSettingsMessengerResourceActions = ChatSettingsResourceActions;
export type ChatSettingsMessengerPromptActions = ChatSettingsPromptActions;

export interface ChatSettingsMessengerActionGroup {
  drawers: ChatSettingsDrawerActions;
  identity: ChatSettingsIdentityActions;
  prompt: ChatSettingsPromptActions;
  resources: ChatSettingsResourceActions;
}

export interface ChatSettingsRoleplaySettings {
  activeRoleplayThread: RoleplayThread | null;
  activeRoleplayThreadId: string | null;
  chatSettingsViewModel: ChatSettingsViewModel;
  companionSelectorOpen: boolean;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
}

export interface ChatSettingsRoleplayActionGroup {
  drawers: ChatSettingsDrawerActions;
  identity: ChatSettingsIdentityActions;
  resources: ChatSettingsResourceActions;
}
