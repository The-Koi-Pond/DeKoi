import type { GenerationParameterSettings } from "../../generation-core/generation-parameter-contract";

export interface PromptPresetParameters extends GenerationParameterSettings {
  maxContext?: number | null;
  assistantPrefill?: string | null;
  customThinkingTags?: string | null;
  squashSystemMessages?: boolean | null;
  showThoughts?: boolean | null;
  useMaxContext?: boolean | null;
  strictRoleFormatting?: boolean | null;
  singleUserMessage?: boolean | null;
}

interface PromptPresetChoiceOption {
  id: string;
  label: string;
  value: string;
  description?: string | null;
}

export interface PromptPresetChoiceBlock {
  id: string;
  presetId?: string | null;
  variableName: string;
  question?: string | null;
  label: string;
  options: PromptPresetChoiceOption[];
  defaultOptionId?: string | null;
  multiSelect?: boolean;
  separator?: string | null;
  displayMode?: "auto" | "buttons" | "listbox" | null;
  optionSort?: "manual" | "alphabetical" | null;
  sortOrder?: number | null;
  createdAt?: string | null;
}

/**
 * Selects a prompt-preset choice by stable option id when the option value is
 * empty or duplicated.
 */
export interface PromptPresetChoiceOptionSelection {
  kind: "option";
  optionId: string;
}

/**
 * String selections resolve by option value, then option id. Object selections
 * preserve option identity; arrays represent multi-select choices.
 */
export type PromptPresetChoiceSelectionValue = string | PromptPresetChoiceOptionSelection;
export type PromptPresetChoiceSelection =
  PromptPresetChoiceSelectionValue | PromptPresetChoiceSelectionValue[];
export type PromptPresetChoiceSelections = Record<string, PromptPresetChoiceSelection>;
/** Native thread selections use stable option IDs; arrays preserve multi-select order. */
export type PromptPresetThreadChoiceSelection =
  PromptPresetChoiceOptionSelection | PromptPresetChoiceOptionSelection[];
/** Maps stable choice-block IDs to native thread selections. */
export type PromptPresetThreadChoiceSelections = Record<string, PromptPresetThreadChoiceSelection>;

export type PromptPresetSectionRole = "system" | "user" | "assistant";

interface PromptPresetMarkerConfig {
  type: string;
}

export interface PromptPresetSection {
  id: string;
  presetId?: string | null;
  identifier: string;
  name: string;
  content: string;
  role: PromptPresetSectionRole;
  enabled: boolean;
  isMarker: boolean;
  groupId?: string | null;
  markerConfig?: PromptPresetMarkerConfig | null;
  injectionPosition?: string | null;
  injectionDepth?: number | null;
  injectionOrder?: number | null;
  wrapInXml?: boolean;
  xmlTagName?: string | null;
  forbidOverrides?: boolean;
}

export interface PromptPresetGroup {
  id: string;
  presetId?: string | null;
  name: string;
  parentGroupId?: string | null;
  order?: number | null;
  enabled?: boolean;
  createdAt?: string | null;
}

export interface PromptPresetRecord {
  id: string;
  schemaVersion: 1;
  title: string;
  summary?: string | null;
  systemPrompt: string;
  messengerPrompt?: string | null;
  parameters?: PromptPresetParameters | null;
  sectionOrder: string[];
  groupOrder: string[];
  variableOrder: string[];
  variableGroups: unknown[];
  variableValues: Record<string, string>;
  defaultChoices: PromptPresetChoiceSelections;
  wrapFormat?: string | null;
  author?: string | null;
  folderId?: string | null;
  sections: PromptPresetSection[];
  groups: PromptPresetGroup[];
  choiceBlocks: PromptPresetChoiceBlock[];
  createdAt: string;
  updatedAt: string;
}

export function resolvePromptPresetMessengerPrompt(preset: PromptPresetRecord | null | undefined) {
  const messengerPrompt = preset?.messengerPrompt?.trim();
  return messengerPrompt || preset?.systemPrompt.trim() || null;
}
