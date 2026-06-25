import type { CharacterRecord } from "../../engine/character";
import type { CharacterRecordInput } from "../../engine/character-actions";
import type { ClassicThread } from "../../engine/classic";
import type {
  LorebookEntryRecord,
  LorebookRecord,
} from "../../engine/lorebook";
import type {
  LorebookEntryInput,
  LorebookInput,
} from "../../engine/lorebook-actions";
import type { MessengerThread } from "../../engine/messenger";
import type { PersonaRecord } from "../../engine/persona";
import type { PersonaRecordInput } from "../../engine/persona-actions";
import type {
  ProviderConnectionId,
  ProviderConnectionRecord,
} from "../../engine/provider-connection";
import type { ProviderConnectionInput } from "../../engine/provider-connection-actions";
import type { RippleState, RippleStateOwnerKind } from "../../engine/ripples";
import type { RippleInput } from "../../engine/ripple-actions";
import type { SurfaceId } from "../../engine/surfaces";
import type { AppSettings, ShoalSortMode } from "../../engine/app-settings";
import type {
  DeKoiLegacyImportData,
  DeKoiStorageBundle,
} from "../runtime";
import type {
  MessengerStorageMode,
  MessengerStorageStatus,
} from "../runtime";

export type PondView =
  | { kind: "pond" }
  | { kind: "classic"; threadId: string }
  | { kind: "messenger"; threadId: string }
  | { kind: "companions"; characterId?: string; mode?: "new" }
  | { kind: "personas"; personaId?: string; mode?: "new" }
  | { kind: "lorebooks"; lorebookId?: string; mode?: "new-lorebook" };

export type SideRailView = "shoal" | "lorebooks" | "people";

export interface NavState {
  view: PondView;
  sideRailView: SideRailView;
  selectedSurface: SurfaceId;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  classicThreads: ClassicThread[];
  messengerThreads: MessengerThread[];
  rippleStates: RippleState[];
  messengerStorageMode: MessengerStorageMode;
  messengerStorageStatus: MessengerStorageStatus;
  messengerStorageMessage: string;
  remoteRuntimeUrl: string;
  appSettings: AppSettings;
  careOpen: boolean;
  careTab: number;
}

export interface NavContextType extends NavState {
  setView: (view: PondView) => void;
  setSideRailView: (view: SideRailView) => void;
  setSelectedSurface: (surface: SurfaceId) => void;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  createCharacter: (input: CharacterRecordInput) => CharacterRecord;
  updateCharacter: (characterId: string, input: CharacterRecordInput) => void;
  duplicateCharacter: (characterId: string) => CharacterRecord | null;
  deleteCharacter: (characterId: string) => void;
  createPersona: (input: PersonaRecordInput) => PersonaRecord;
  updatePersona: (personaId: string, input: PersonaRecordInput) => void;
  duplicatePersona: (personaId: string) => PersonaRecord | null;
  deletePersona: (personaId: string) => void;
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
  createProviderConnection: (
    input: ProviderConnectionInput,
  ) => ProviderConnectionRecord;
  updateProviderConnection: (
    connectionId: string,
    input: ProviderConnectionInput,
  ) => void;
  duplicateProviderConnection: (
    connectionId: string,
  ) => ProviderConnectionRecord | null;
  deleteProviderConnection: (connectionId: string) => void;
  createClassicThread: () => ClassicThread;
  updateClassicThread: (thread: ClassicThread) => void;
  renameClassicThread: (threadId: string, title: string) => void;
  clearClassicThreadEntries: (threadId: string) => void;
  deleteClassicThread: (threadId: string) => void;
  openClassicThread: (threadId: string) => void;
  createMessengerThread: () => MessengerThread;
  updateMessengerThread: (thread: MessengerThread) => void;
  renameMessengerThread: (threadId: string, title: string) => void;
  clearMessengerThreadMessages: (threadId: string) => void;
  deleteMessengerThread: (threadId: string) => void;
  openMessengerThread: (threadId: string) => void;
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
  createStorageBundle: () => DeKoiStorageBundle;
  importStorageBundle: (bundle: DeKoiStorageBundle) => void;
  importLegacyData: (data: DeKoiLegacyImportData) => void;
  setRemoteRuntimeUrl: (url: string) => void;
  setSendOnEnterSurface: (surface: SurfaceId) => void;
  setConfirmRelease: (confirmRelease: boolean) => void;
  setSurfaceStatus: (status: string) => void;
  setShoalSortMode: (sortMode: ShoalSortMode) => void;
  setActiveMessengerConnectionId: (connectionId: ProviderConnectionId) => void;
  setCareOpen: (open: boolean) => void;
  setCareTab: (tab: number) => void;
}
