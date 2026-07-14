import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { CharacterRecordInput } from "../../../engine/catalog/character-actions";
import type { RoleplayEntry, RoleplayThread } from "../../../engine/contracts/types/roleplay";
import type { LoreEntryRecord, LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type {
  LoreRuntimeState,
  LoreRuntimeStateOwnerKind,
} from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { LorebookEntryInput, LorebookInput } from "../../../engine/catalog/lorebook-actions";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PersonaRecordInput } from "../../../engine/catalog/persona-actions";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";
import type { PromptPresetRelationshipTransactionResult } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import type { ProviderConnectionInput } from "../../../engine/catalog/provider-connection-actions";
import type { RippleState, RippleStateOwnerKind } from "../../../engine/contracts/types/ripples";
import type { RippleInput } from "../../../engine/ripples/ripple-actions";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import type {
  AppSettings,
  AppSettingsPatch,
  ShoalSortMode,
} from "../../../engine/contracts/types/app-settings";
import type {
  AppStorageCollectionKey,
  AppStorageReplaceResult,
  DeKoiLegacyImportData,
  DeKoiStorageBundle,
  PromptPresetFileExportResult,
  PromptPresetFileImportResult,
} from "../../runtime";
import type { MessengerStorageMode, MessengerStorageStatus } from "../../runtime";

export type PondView =
  | { kind: "pond" }
  | { kind: "roleplay"; threadId: string }
  | { kind: "messenger"; threadId: string }
  | { kind: "companions"; characterId?: string; mode?: "new" }
  | { kind: "connections"; connectionId?: ProviderConnectionId; mode?: "new" }
  | { kind: "personas"; personaId?: string; mode?: "new" }
  | { kind: "lorebooks"; lorebookId?: string; mode?: "new-lorebook" }
  | { kind: "presets"; presetId?: string; mode?: "new" };

export type SideRailView =
  "shoal" | "chat-settings" | "lorebooks" | "people" | "media" | "presets" | "connections";

export interface NavViewState {
  view: PondView;
  sideRailView: SideRailView;
  selectedSurface: SurfaceId;
}

export interface NavCatalogState {
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets: PromptPresetRecord[];
  promptPresetFileHost: "browser" | "desktop";
  promptPresetFileStatus: string;
  providerConnections: ProviderConnectionRecord[];
}

export interface NavThreadState {
  roleplayThreads: RoleplayThread[];
  messengerThreads: MessengerThread[];
}

export interface NavRippleState {
  rippleStates: RippleState[];
}

export interface NavLoreRuntimeState {
  loreRuntimeStates: LoreRuntimeState[];
}

export interface NavMacroVariableState {
  macroVariableStates: MacroVariableScope[];
}

export interface NavStorageState {
  messengerStorageMode: MessengerStorageMode;
  messengerStorageStatus: MessengerStorageStatus;
  messengerStorageMessage: string;
  storageReady: boolean;
  storageHasUnsavedChanges: boolean;
  importRecoveryState: NavStorageImportRecoveryState;
  /** Per-collection records dropped during the most recent load (empty when none). */
  droppedRecordCountByCollection: Partial<Record<AppStorageCollectionKey, number>>;
  /** Per-collection errors from the most recent storage load attempt (empty when none). */
  storageLoadErrorMessageByCollection: Partial<Record<AppStorageCollectionKey, string>>;
  remoteRuntimeUrl: string;
}

export interface NavSettingsState {
  appSettings: AppSettings;
}

export interface NavCareState {
  careOpen: boolean;
  careTab: number;
}

interface NavState
  extends
    NavViewState,
    NavCatalogState,
    NavThreadState,
    NavRippleState,
    NavLoreRuntimeState,
    NavMacroVariableState,
    NavStorageState,
    NavSettingsState,
    NavCareState {}

export interface NavViewActions {
  setView: (view: PondView) => void;
  setSideRailView: (view: SideRailView) => void;
  setSelectedSurface: (surface: SurfaceId) => void;
  openRoleplayThread: (threadId: string) => void;
  openMessengerThread: (threadId: string) => void;
}

export interface NavSettingsActions {
  setRemoteRuntimeUrl: (url: string) => void;
  updateAppSettings: (patch: AppSettingsPatch) => void;
  setSendOnEnterSurface: (surface: SurfaceId) => void;
  setConfirmRelease: (confirmRelease: boolean) => void;
  setSurfaceStatus: (status: string) => void;
  setShoalSortMode: (sortMode: ShoalSortMode) => void;
  setActiveMessengerConnectionId: (connectionId: ProviderConnectionId) => void;
}

export interface NavCharacterActions {
  createCharacter: (input: CharacterRecordInput) => CharacterRecord;
  updateCharacter: (characterId: string, input: CharacterRecordInput) => void;
  duplicateCharacter: (characterId: string) => CharacterRecord | null;
  deleteCharacter: (characterId: string) => void;
}

export interface NavPersonaActions {
  createPersona: (input: PersonaRecordInput) => PersonaRecord;
  updatePersona: (personaId: string, input: PersonaRecordInput) => void;
  duplicatePersona: (personaId: string) => PersonaRecord | null;
  deletePersona: (personaId: string) => void;
}

export interface NavLorebookActions {
  createLorebookEntry: (lorebookId: string, input: LorebookEntryInput) => LoreEntryRecord | null;
  updateLorebookEntry: (lorebookId: string, entryId: string, input: LorebookEntryInput) => void;
  duplicateLorebookEntry: (lorebookId: string, entryId: string) => LoreEntryRecord | null;
  deleteLorebookEntry: (lorebookId: string, entryId: string) => void;
  createLorebook: (input: LorebookInput) => LorebookRecord;
  updateLorebook: (lorebookId: string, input: LorebookInput) => void;
  deleteLorebook: (lorebookId: string) => void;
}

export interface NavPromptPresetActions {
  createPromptPreset: (input: PromptPresetInput) => PromptPresetRecord;
  updatePromptPreset: (presetId: string, input: PromptPresetInput) => void;
  duplicatePromptPreset: (presetId: string) => PromptPresetRecord | null;
  deletePromptPreset: (presetId: string) => Promise<PromptPresetRelationshipTransactionResult>;
  importPromptPresetFile: (file: File) => Promise<NavPromptPresetFileImportResult>;
  openPromptPresetFile: () => Promise<NavPromptPresetFileImportResult>;
  exportPromptPresetFile: (presetId: string) => Promise<NavPromptPresetFileExportResult>;
  setPromptPresetFileStatus: (status: string) => void;
}

export type NavPromptPresetFileImportResult = PromptPresetFileImportResult;

export type NavPromptPresetFileExportResult = PromptPresetFileExportResult;

export interface NavProviderConnectionActions {
  createProviderConnection: (input: ProviderConnectionInput) => Promise<ProviderConnectionRecord>;
  updateProviderConnection: (connectionId: string, input: ProviderConnectionInput) => Promise<void>;
  duplicateProviderConnection: (connectionId: string) => ProviderConnectionRecord | null;
  deleteProviderConnection: (connectionId: string) => Promise<void>;
}

export interface MessengerThreadCreateInput {
  activePersonaId?: string | null;
  characterIds?: string[];
  lorebookIds?: string[];
  providerConnectionId?: ProviderConnectionId | null;
  title?: string;
}

export interface RoleplayThreadCreateInput {
  activePersonaId?: string | null;
  characterIds?: string[];
  lorebookIds?: string[];
  providerConnectionId?: ProviderConnectionId | null;
  title?: string;
}

export interface NavRoleplayThreadActions {
  createRoleplayThread: (input?: RoleplayThreadCreateInput) => RoleplayThread;
  updateRoleplayThread: (thread: RoleplayThread) => void;
  updateRoleplayThreadById: (
    threadId: string,
    updater: (thread: RoleplayThread) => RoleplayThread,
  ) => void;
  appendRoleplayThreadEntries: (threadId: string, entries: RoleplayEntry[]) => void;
  renameRoleplayThread: (threadId: string, title: string) => void;
  clearRoleplayThreadEntries: (threadId: string) => void;
  deleteRoleplayThread: (threadId: string) => void;
  roleplayPromptPresetRepairNotices: Record<string, string>;
  clearRoleplayPromptPresetRepairNotice: (threadId: string) => void;
}

export interface NavMessengerThreadActions {
  createMessengerThread: (input?: MessengerThreadCreateInput) => MessengerThread;
  updateMessengerThread: (thread: MessengerThread) => void;
  updateMessengerThreadById: (
    threadId: string,
    updater: (thread: MessengerThread) => MessengerThread,
  ) => void;
  appendMessengerThreadMessages: (threadId: string, messages: MessengerMessage[]) => void;
  renameMessengerThread: (threadId: string, title: string) => void;
  clearMessengerThreadMessages: (threadId: string) => void;
  deleteMessengerThread: (threadId: string) => void;
  messengerPromptPresetRepairNotices: Record<string, string>;
  clearMessengerPromptPresetRepairNotice: (threadId: string) => void;
}

interface NavRippleActions {
  getRippleState: (ownerKind: RippleStateOwnerKind, ownerId: string) => RippleState | null;
  createRipple: (ownerKind: RippleStateOwnerKind, ownerId: string, input: RippleInput) => void;
  updateRipple: (
    ownerKind: RippleStateOwnerKind,
    ownerId: string,
    rippleId: string,
    input: RippleInput,
  ) => void;
  deleteRipple: (ownerKind: RippleStateOwnerKind, ownerId: string, rippleId: string) => void;
}

export interface NavLoreRuntimeActions {
  getLoreRuntimeState: (
    ownerKind: LoreRuntimeStateOwnerKind,
    ownerId: string,
  ) => LoreRuntimeState | null;
  updateLoreRuntimeState: (
    runtimeState: LoreRuntimeState | null,
    ownerKind: LoreRuntimeStateOwnerKind,
    ownerId: string,
  ) => void;
}

export interface NavMacroVariableActions {
  updateMacroVariableStates: (
    nextStates:
      MacroVariableScope[] | ((currentStates: MacroVariableScope[]) => MacroVariableScope[]),
  ) => void;
}

export interface NavStorageBundleActions {
  createStorageBundle: () => DeKoiStorageBundle;
  importStorageBundle: (
    bundle: DeKoiStorageBundle,
    options: { previewFingerprint: string; desktopBackupPath?: string | null },
  ) => Promise<AppStorageReplaceResult>;
  importLegacyData: (
    data: DeKoiLegacyImportData,
    options: { previewFingerprint: string; desktopBackupPath?: string | null },
  ) => Promise<AppStorageReplaceResult>;
}

type NavStorageStaleCheckResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
  checked: boolean;
  metadataAvailable: boolean;
  stale: boolean;
  changedCollectionKeys: AppStorageCollectionKey[];
};

type NavStorageReloadResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
  blocked: boolean;
  reloaded: boolean;
};

type NavStorageFlushReason = "backup" | "export" | "import" | "reload" | "shutdown" | "manual";

type NavStorageFlushResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
  flushed: boolean;
  blocked: boolean;
  dirtyCollectionKeys: AppStorageCollectionKey[];
  savedCollectionKeys: AppStorageCollectionKey[];
  failedCollectionKeys: AppStorageCollectionKey[];
};

type NavStorageImportRecoveryState = {
  available: boolean;
  createdAt: string | null;
  counts: Record<AppStorageCollectionKey, number> | null;
  desktopBackupPath?: string | null;
  reason: "partial-import-failure" | "unexpected-import-failure" | null;
};

export interface NavStorageActions {
  checkAppStorageStale: () => Promise<NavStorageStaleCheckResult>;
  flushAppStorageSaves: (options?: {
    reason?: NavStorageFlushReason;
  }) => Promise<NavStorageFlushResult>;
  reloadAppStorage: () => Promise<NavStorageReloadResult>;
  restoreLastPreImportBackup: () => Promise<AppStorageReplaceResult>;
}

export interface NavCareActions {
  setCareOpen: (open: boolean) => void;
  setCareTab: (tab: number) => void;
}

interface NavActions
  extends
    NavViewActions,
    NavSettingsActions,
    NavCharacterActions,
    NavPersonaActions,
    NavLorebookActions,
    NavPromptPresetActions,
    NavProviderConnectionActions,
    NavRoleplayThreadActions,
    NavMessengerThreadActions,
    NavRippleActions,
    NavLoreRuntimeActions,
    NavMacroVariableActions,
    NavStorageBundleActions,
    NavStorageActions,
    NavCareActions {}

export interface NavContextType extends NavState, NavActions {}
