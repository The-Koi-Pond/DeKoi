import type {
  PromptPresetGroup,
  PromptPresetParameters,
  PromptPresetRecord,
  PromptPresetSection,
} from "../../../engine/contracts/types/prompt-presets";
import {
  GENERATION_PARAMETER_SPEC,
  STANDARD_GENERATION_PARAMETER_KEYS,
  isGenerationNumericParameterKey,
  type GenerationDraftParameterEntries,
  type GenerationDraftParameterEntry,
  type StandardGenerationParameterKey,
  type StandardGenerationParameterValue,
} from "../../../engine/generation-core/generation-parameter-contract";
import { type PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";
import {
  DEFAULT_PROMPT_PRESET_MARKER_TYPE,
  normalizePromptPresetMarkerType,
  promptPresetSectionMarkerType,
  promptPresetSectionsInOrder,
} from "../../../engine/prompt-presets/prompt-preset-section-policy";
import {
  choiceDraftFromPromptPreset,
  promptPresetChoiceDraftToInput,
  validatePromptPresetChoiceDraft,
  type PromptPresetChoiceDraftState,
} from "./prompt-preset-choice-draft";

export type PromptPresetDraftParameters = Omit<
  PromptPresetParameters,
  StandardGenerationParameterKey
> &
  GenerationDraftParameterEntries;

export interface PromptPresetDraftState extends PromptPresetChoiceDraftState {
  name: string;
  description: string;
  messengerPrompt: string;
  parameters: PromptPresetDraftParameters;
  wrapFormat: string;
  sections: PromptPresetSection[];
  groups: PromptPresetGroup[];
}

export const EMPTY_PROMPT_PRESET_DRAFT: PromptPresetDraftState = {
  name: "",
  description: "",
  messengerPrompt: "",
  parameters: {},
  wrapFormat: "",
  sections: [],
  groups: [],
  choiceBlocks: [],
  defaultOptionIdsByBlockId: {},
};

let draftIdCounter = 0;

function createDraftId(prefix: string) {
  draftIdCounter += 1;
  return `${prefix}-${Date.now()}-${draftIdCounter}`;
}

function cloneSections(sections: readonly PromptPresetSection[]) {
  return sections.map((section) => ({
    ...section,
    markerConfig: section.markerConfig ? { ...section.markerConfig } : section.markerConfig,
  }));
}

function cloneGroups(groups: readonly PromptPresetGroup[]) {
  return groups.map((group) => ({ ...group }));
}

function rowsInOrder<T extends { id: string }>(rows: readonly T[], order: readonly string[]) {
  const rowById = new Map(rows.map((row) => [row.id, row] as const));
  const seen = new Set<string>();
  const orderedRows: T[] = [];

  for (const id of order) {
    if (seen.has(id)) continue;
    const row = rowById.get(id);
    if (!row) continue;
    seen.add(id);
    orderedRows.push(row);
  }

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    orderedRows.push(row);
  }

  return orderedRows;
}

function cleanNullableString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function cleanNullableNonNegativeInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : null;
}

function cleanSections(sections: readonly PromptPresetSection[]) {
  return cloneSections(sections).map((section) => {
    const markerType = section.isMarker
      ? normalizePromptPresetMarkerType(promptPresetSectionMarkerType(section))
      : null;
    const identifier = markerType ?? (section.identifier.trim() || section.id);
    const cleanSection: PromptPresetSection = {
      ...section,
      identifier,
      name: section.name.trim() || identifier,
      content: section.isMarker ? "" : section.content.trim(),
      role: section.role,
      enabled: section.enabled,
      isMarker: section.isMarker,
    };

    const groupId = cleanNullableString(section.groupId);
    if (groupId) {
      cleanSection.groupId = groupId;
    } else {
      delete cleanSection.groupId;
    }

    if (markerType) {
      cleanSection.markerConfig = { ...section.markerConfig, type: markerType };
    } else {
      delete cleanSection.markerConfig;
    }

    const injectionPosition = cleanNullableString(section.injectionPosition);
    if (injectionPosition) {
      cleanSection.injectionPosition = injectionPosition;
    } else {
      delete cleanSection.injectionPosition;
    }

    const injectionDepth = cleanNullableNonNegativeInteger(section.injectionDepth);
    if (injectionDepth === null) {
      delete cleanSection.injectionDepth;
    } else {
      cleanSection.injectionDepth = injectionDepth;
    }

    if (section.injectionOrder === null || section.injectionOrder === undefined) {
      delete cleanSection.injectionOrder;
    }

    const xmlTagName = section.isMarker ? null : cleanNullableString(section.xmlTagName);
    if (xmlTagName) {
      cleanSection.xmlTagName = xmlTagName;
    } else {
      delete cleanSection.xmlTagName;
    }

    return cleanSection;
  });
}

function cleanGroups(groups: readonly PromptPresetGroup[]) {
  return cloneGroups(groups).map((group) => {
    const cleanGroup: PromptPresetGroup = {
      ...group,
      name: group.name.trim() || group.id,
    };
    const parentGroupId = cleanNullableString(group.parentGroupId);
    if (parentGroupId) {
      cleanGroup.parentGroupId = parentGroupId;
    } else {
      delete cleanGroup.parentGroupId;
    }
    return cleanGroup;
  });
}

export function createPromptPresetDraftSection(kind: "section" | "marker" = "section") {
  const id = createDraftId(`preset-${kind}`);
  const isMarker = kind === "marker";
  return {
    id,
    identifier: isMarker ? DEFAULT_PROMPT_PRESET_MARKER_TYPE : id,
    name: isMarker ? "Chat History" : "New Section",
    content: "",
    role: "system",
    enabled: true,
    isMarker,
    markerConfig: isMarker ? { type: DEFAULT_PROMPT_PRESET_MARKER_TYPE } : null,
  } satisfies PromptPresetSection;
}

export function createPromptPresetDraftGroup() {
  const id = createDraftId("preset-group");
  return {
    id,
    name: "New Group",
    enabled: true,
  } satisfies PromptPresetGroup;
}

export function updatePromptPresetDraftSectionKind(
  section: PromptPresetSection,
  kind: "section" | "marker",
): PromptPresetSection {
  const isMarker = kind === "marker";
  const markerType = normalizePromptPresetMarkerType(promptPresetSectionMarkerType(section));

  return {
    ...section,
    isMarker,
    markerConfig: isMarker ? { type: markerType } : null,
  };
}

export function updatePromptPresetDraftSectionMarkerType(
  section: PromptPresetSection,
  markerType: string,
): PromptPresetSection {
  return {
    ...section,
    markerConfig: {
      ...section.markerConfig,
      type: normalizePromptPresetMarkerType(markerType),
    },
  };
}

export function canSavePromptPresetDraft(draft: PromptPresetDraftState) {
  return promptPresetDraftValidationErrors(draft).length === 0;
}

export function promptPresetDraftParameterError<Key extends StandardGenerationParameterKey>(
  field: Key,
  entry: GenerationDraftParameterEntries[Key],
) {
  if (!entry) return null;

  if (isGenerationNumericParameterKey(field)) {
    const value = entry.value;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
      return "Enter a valid value or turn Send off.";
    }
    if (!entry.send) return null;
    if (value === null) return "Enter a valid value or turn Send off.";

    const constraint = GENERATION_PARAMETER_SPEC[field];
    if (value < constraint.minimum || value > constraint.maximum) {
      return `Enter a value from ${constraint.minimum} to ${constraint.maximum}, or turn Send off.`;
    }
    if (constraint.integer && !Number.isInteger(value)) {
      return "Enter a whole number or turn Send off.";
    }
    return null;
  }

  return entry.send && entry.value === null ? "Enter a valid value or turn Send off." : null;
}

export function promptPresetDraftValidationErrors(draft: PromptPresetDraftState) {
  const errors = validatePromptPresetChoiceDraft(draft).map((issue) => issue.message);
  if (!draft.name.trim()) errors.push("Name is required.");
  for (const field of STANDARD_GENERATION_PARAMETER_KEYS) {
    const error = promptPresetDraftParameterError(field, draft.parameters[field]);
    if (error) errors.push(`${field}: ${error}`);
  }
  return errors;
}

export function promptPresetDraftParameterEntry<Key extends StandardGenerationParameterKey>(
  parameters: PromptPresetDraftParameters,
  key: Key,
): GenerationDraftParameterEntries[Key] {
  return parameters[key];
}

export function withPromptPresetDraftParameterEntry<Key extends StandardGenerationParameterKey>(
  draft: PromptPresetDraftState,
  key: Key,
  entry: GenerationDraftParameterEntry<StandardGenerationParameterValue<Key>>,
): PromptPresetDraftState {
  return {
    ...draft,
    parameters: { ...draft.parameters, [key]: entry },
  };
}

export function draftFromPromptPreset(preset: PromptPresetRecord): PromptPresetDraftState {
  return {
    ...choiceDraftFromPromptPreset(preset),
    name: preset.name,
    description: preset.description ?? "",
    messengerPrompt: preset.messengerPrompt,
    parameters: preset.parameters ? structuredClone(preset.parameters) : {},
    wrapFormat: preset.wrapFormat ?? "",
    sections: cloneSections(promptPresetSectionsInOrder(preset.sections, preset.sectionOrder)),
    groups: cloneGroups(rowsInOrder(preset.groups, preset.groupOrder)),
  };
}

export function promptPresetDraftToInput(draft: PromptPresetDraftState): PromptPresetInput {
  const sections = cleanSections(draft.sections);
  const groups = cleanGroups(draft.groups);
  const choiceInput = promptPresetChoiceDraftToInput(draft);

  return {
    ...choiceInput,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    messengerPrompt: draft.messengerPrompt.trim(),
    parameters: structuredClone(draft.parameters) as PromptPresetParameters,
    sectionOrder: sections.map((section) => section.id),
    groupOrder: groups.map((group) => group.id),
    wrapFormat: draft.wrapFormat.trim() || null,
    sections,
    groups,
  };
}

export function promptPresetDraftsMatch(
  left: PromptPresetDraftState,
  right: PromptPresetDraftState,
) {
  return (
    JSON.stringify(promptPresetDraftToInput(left)) ===
    JSON.stringify(promptPresetDraftToInput(right))
  );
}

export function removePromptPresetDraftGroup(
  draft: PromptPresetDraftState,
  groupId: string,
): PromptPresetDraftState {
  return {
    ...draft,
    groups: draft.groups
      .filter((group) => group.id !== groupId)
      .map((group) =>
        group.parentGroupId === groupId ? { ...group, parentGroupId: null } : group,
      ),
    sections: draft.sections.map((section) =>
      section.groupId === groupId ? { ...section, groupId: null } : section,
    ),
  };
}

export function movePromptPresetDraftSection(
  sections: PromptPresetSection[],
  sectionId: string,
  direction: -1 | 1,
) {
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) return sections;

  const nextSections = [...sections];
  const [section] = nextSections.splice(currentIndex, 1);
  if (!section) return sections;
  nextSections.splice(nextIndex, 0, section);
  return nextSections;
}
