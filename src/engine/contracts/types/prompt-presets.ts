export interface PromptPresetSampling {
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
}

export interface PromptPresetParameters extends PromptPresetSampling {
  topK?: number | null;
  minP?: number | null;
  maxContext?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  reasoningEffort?: string | null;
  verbosity?: string | null;
  serviceTier?: string | null;
  assistantPrefill?: string | null;
  customThinkingTags?: string | null;
  customParameters?: Record<string, unknown> | null;
  enabledParameters?: Record<string, boolean> | null;
  squashSystemMessages?: boolean | null;
  showThoughts?: boolean | null;
  useMaxContext?: boolean | null;
  stopSequences?: string[];
  strictRoleFormatting?: boolean | null;
  singleUserMessage?: boolean | null;
}

export interface PromptPresetVisibilityRule {
  variableName: string;
  values: string[];
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
  randomPick?: boolean;
  displayMode?: "auto" | "buttons" | "listbox" | null;
  optionSort?: "manual" | "alphabetical" | null;
  sortOrder?: number | null;
  createdAt?: string | null;
  visibilityRule?: PromptPresetVisibilityRule | null;
}

export type PromptPresetChoiceSelection = string | string[];
export type PromptPresetChoiceSelections = Record<string, PromptPresetChoiceSelection>;

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
  sampling?: PromptPresetSampling | null;
  parameters?: PromptPresetParameters | null;
  sectionOrder: string[];
  groupOrder: string[];
  variableOrder: string[];
  variableGroups: unknown[];
  variableValues: Record<string, string>;
  defaultChoices: PromptPresetChoiceSelections;
  wrapFormat?: string | null;
  isDefault?: boolean;
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
