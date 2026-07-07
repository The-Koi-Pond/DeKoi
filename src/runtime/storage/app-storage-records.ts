import type { AppSettings } from "../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../engine/contracts/types/character";
import type { LorebookRecord } from "../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../engine/contracts/types/macro-variables";
import type { MessengerThread } from "../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../engine/contracts/types/ripples";
import type { RoleplayThread } from "../../engine/contracts/types/roleplay";

export type AppStorageRecords = {
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  loreRuntimeStates: LoreRuntimeState[];
  macroVariableStates: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  roleplayThreads: RoleplayThread[];
  messengerThreads: MessengerThread[];
  rippleStates: RippleState[];
};

export type AppStorageCollectionKey =
  | "appSettings"
  | "characters"
  | "personas"
  | "lorebooks"
  | "loreRuntimeStates"
  | "macroVariableStates"
  | "providerConnections"
  | "roleplayThreads"
  | "roleplayEntries"
  | "messengerThreads"
  | "messengerMessages"
  | "rippleStates";

export const APP_STORAGE_COLLECTION_KEYS = [
  "appSettings",
  "characters",
  "personas",
  "lorebooks",
  "loreRuntimeStates",
  "macroVariableStates",
  "providerConnections",
  "roleplayThreads",
  "roleplayEntries",
  "messengerThreads",
  "messengerMessages",
  "rippleStates",
] as const satisfies readonly AppStorageCollectionKey[];
