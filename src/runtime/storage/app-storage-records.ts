import type { AppSettings } from "../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../engine/contracts/types/character";
import type { LorebookRecord } from "../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../engine/contracts/types/macro-variables";
import type { ModeThread } from "../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../engine/contracts/types/ripples";

export type AppStorageRecords = {
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets: PromptPresetRecord[];
  loreRuntimeStates: LoreRuntimeState[];
  macroVariableStates: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  modeThreads: ModeThread[];
  rippleStates: RippleState[];
};

export type AppStorageCollectionKey =
  | "appSettings"
  | "characters"
  | "personas"
  | "lorebooks"
  | "promptPresets"
  | "loreRuntimeStates"
  | "macroVariableStates"
  | "providerConnections"
  | "modeThreads"
  | "modeMessages"
  | "rippleStates";

export const APP_STORAGE_COLLECTION_KEYS = [
  "appSettings",
  "characters",
  "personas",
  "lorebooks",
  "promptPresets",
  "loreRuntimeStates",
  "macroVariableStates",
  "providerConnections",
  "modeThreads",
  "modeMessages",
  "rippleStates",
] as const satisfies readonly AppStorageCollectionKey[];
