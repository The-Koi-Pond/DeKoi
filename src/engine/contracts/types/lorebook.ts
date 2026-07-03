export const LOREBOOK_SURFACE_LABEL = "Lorebooks";

export type LoreEntryStrategy = "selective" | "constant";
export type LoreSelectiveLogic = "and-any" | "and-all" | "not-any" | "not-all";
export type LoreInsertionPosition = "before-character" | "after-character" | "at-depth";
export type LoreEntryRole = "system" | "user" | "assistant";
export type LoreGenerationTriggerType =
  "normal" | "continue" | "impersonate" | "swipe" | "regenerate" | "quiet";

export interface LoreEntryRecursion {
  nonRecursable: boolean;
  preventFurther: boolean;
  delayUntilRecursion: boolean;
  recursionLevel: number;
}

export interface LoreEntryTiming {
  sticky: number;
  cooldown: number;
  delay: number;
}

export interface LoreEntryTriggers {
  types: LoreGenerationTriggerType[] | null;
}

export interface LoreCharacterFilter {
  mode: "include" | "exclude";
  characterIds: string[];
}

/** Per-entry optional fields scanned in addition to recent transcript text. */
export interface LoreMatchSources {
  characterDescription: boolean;
  characterPersonality: boolean;
  scenario: boolean;
  characterNote: boolean;
  personaDescription: boolean;
}

export interface LorebookActivationSettings {
  scanDepth: number;
  includeNames: boolean;
  caseSensitiveKeys: boolean;
  matchWholeWords: boolean;
  recursiveScan: boolean;
  maxRecursionSteps: number;
  budgetTokens: number | null;
  budgetPercent: number | null;
}

export const DEFAULT_LOREBOOK_ACTIVATION: LorebookActivationSettings = {
  scanDepth: 2,
  includeNames: true,
  caseSensitiveKeys: false,
  matchWholeWords: true,
  recursiveScan: false,
  maxRecursionSteps: 0,
  budgetTokens: null,
  budgetPercent: 25,
};

export interface LoreEntryRecord {
  id: string;
  schemaVersion: 2;
  title: string;
  body: string;
  enabled: boolean;
  key: string[] | null;
  keySecondary: string[] | null;
  selectiveLogic: LoreSelectiveLogic | null;
  strategy: LoreEntryStrategy;
  probability: number;
  inclusionGroup: string | null;
  insertionPosition: LoreInsertionPosition;
  insertionOrder: number;
  depth: number | null;
  role: LoreEntryRole | null;
  recursion: LoreEntryRecursion | null;
  timing: LoreEntryTiming | null;
  triggers: LoreEntryTriggers | null;
  characterFilter: LoreCharacterFilter | null;
  matchSources: LoreMatchSources | null;
  createdAt: string;
  updatedAt: string;
}

export interface LorebookRecord {
  id: string;
  schemaVersion: 2;
  title: string;
  summary: string;
  activation: LorebookActivationSettings;
  entries: LoreEntryRecord[];
  createdAt: string;
  updatedAt: string;
}
