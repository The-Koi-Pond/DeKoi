import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { CharacterRecordInput } from "../../../engine/character-actions";
import type { RoleplayThread } from "../../../engine/roleplay";
import type {
  LorebookEntryRecord,
  LorebookRecord,
} from "../../../engine/contracts/types/lorebook";
import type {
  LorebookEntryInput,
  LorebookInput,
} from "../../../engine/lorebook-actions";
import type { MessengerThread } from "../../../engine/messenger";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PersonaRecordInput } from "../../../engine/persona-actions";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import type { ProviderConnectionInput } from "../../../engine/provider-connection-actions";
import type { RippleState, RippleStateOwnerKind } from "../../../engine/contracts/types/ripples";
import type { RippleInput } from "../../../engine/ripple-actions";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import type { AppSettings, ShoalSortMode } from "../../../engine/app-settings";
import type {
  AppStorageCollectionKey,
  AppStorageReplaceResult,
  DeKoiLegacyImportData,
  DeKoiStorageBundle,
} from "../../runtime";
import type {
  MessengerStorageMode,
  MessengerStorageStatus,
} from "../../runtime";

export type PondView =
  | { kind: "pond" }
  | { kind: "roleplay"; threadId: string }
  | { kind: "messenger"; threadId: string }
  | { kind: "companions"; characterId?: string; mode?: "new" }
  | { kind: "connections"; connectionId?: ProviderConnectionId; mode?: "new" }
  | { kind: "personas"; personaId?: string; mode?: "new" }
  | { kind: "lorebooks"; lorebookId?: string; mode?: "new-lorebook" };

export type SideRailView =
  | "shoal"
  | "lorebooks"
  | "people"
  | "media"
  | "presets"
  | "connections";

export interface NavViewState {
  view: PondView;
  sideRailView: SideRailView;
  selectedSurface: SurfaceId;
}

export interface NavCatalogState {
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
}

export interface NavThreadState {
  roleplayThreads: RoleplayThread[];
  messengerThreads: MessengerThread[];
}

export interface NavRippleState {
  rippleStates: RippleState[];
}

export interface NavStorageState {
  messengerStorageMode: MessengerStorageMode;
  messengerStorageStatus: MessengerStorageStatus;
  messengerStorageMessage: string;
  storageHasUnsavedChanges: boolean;
  remoteRuntimeUrl: string;
}

export interface NavSettingsState {
  appSettings: AppSettings;
}

export interface NavCareState {
  careOpen: boolean;
  careTab: number;
}

export interface NavState
  extends NavViewState,
    NavCatalogState,
    NavThreadState,
    NavRippleState,
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
  updateAppSettings: (patch: Partial<AppSettings>) => void;
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
  createLorebookEntry: (
    lorebookId: string,
    input: LorebookEntryInput,
  ) => LorebookEntryRecord | null;
  updateLorebookEntry: (
    lorebookId: string,
    entryId: string,
    input: LorebookEntryInput,
  ) => void;
  duplicateLorebookEntry: (
    lorebookId: string,
    entryId: string,
  ) => LorebookEntryRecord | null;
  deleteLorebookEntry: (lorebookId: string, entryId: string) => void;
  createLorebook: (input: LorebookInput) => LorebookRecord;
  updateLorebook: (lorebookId: string, input: LorebookInput) => void;
  deleteLorebook: (lorebookId: string) => void;
}

export interface NavProviderConnectionActions {
  createProviderConnection: (
    input: ProviderConnectionInput,
  ) => Promise<ProviderConnectionRecord>;
  updateProviderConnection: (
    connectionId: string,
    input: ProviderConnectionInput,
  ) => Promise<void>;
  duplicateProviderConnection: (
    connectionId: string,
  ) => ProviderConnectionRecord | null;
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
  renameRoleplayThread: (threadId: string, title: string) => void;
  clearRoleplayThreadEntries: (threadId: string) => void;
  deleteRoleplayThread: (threadId: string) => void;
}

export interface NavMessengerThreadActions {
  createMessengerThread: (input?: MessengerThreadCreateInput) => MessengerThread;
  updateMessengerThread: (thread: MessengerThread) => void;
  renameMessengerThread: (threadId: string, title: string) => void;
  clearMessengerThreadMessages: (threadId: string) => void;
  deleteMessengerThread: (threadId: string) => void;
}

export interface NavRippleActions {
  getRippleState: (
    ownerKind: RippleStateOwnerKind,
    ownerId: string,
  ) => RippleState | null;
  createRipple: (
    ownerKind: RippleStateOwnerKind,
    ownerId: string,
    input: RippleInput,
  ) => void;
  updateRipple: (
    ownerKind: RippleStateOwnerKind,
    ownerId: string,
    rippleId: string,
    input: RippleInput,
  ) => void;
  deleteRipple: (
    ownerKind: RippleStateOwnerKind,
    ownerId: string,
    rippleId: string,
  ) => void;
}

export interface NavStorageBundleActions {
  createStorageBundle: () => DeKoiStorageBundle;
  importStorageBundle: (bundle: DeKoiStorageBundle) => Promise<AppStorageReplaceResult>;
  importLegacyData: (data: DeKoiLegacyImportData) => Promise<AppStorageReplaceResult>;
}

export type NavStorageStaleCheckResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
  checked: boolean;
  metadataAvailable: boolean;
  stale: boolean;
  changedCollectionKeys: AppStorageCollectionKey[];
};

export type NavStorageReloadResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
  blocked: boolean;
  reloaded: boolean;
};

export interface NavStorageActions {
  checkAppStorageStale: () => Promise<NavStorageStaleCheckResult>;
  reloadAppStorage: () => Promise<NavStorageReloadResult>;
}

export interface NavCareActions {
  setCareOpen: (open: boolean) => void;
  setCareTab: (tab: number) => void;
}

export interface NavActions
  extends NavViewActions,
    NavSettingsActions,
    NavCharacterActions,
    NavPersonaActions,
    NavLorebookActions,
    NavProviderConnectionActions,
    NavRoleplayThreadActions,
    NavMessengerThreadActions,
    NavRippleActions,
    NavStorageBundleActions,
    NavStorageActions,
    NavCareActions {}

export interface NavContextType extends NavState, NavActions {}
