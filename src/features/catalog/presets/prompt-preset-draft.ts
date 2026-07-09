import type {
  PromptPresetGroup,
  PromptPresetRecord,
  PromptPresetSection,
} from "../../../engine/contracts/types/prompt-presets";
import {
  DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT,
  type PromptPresetInput,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import {
  DEFAULT_PROMPT_PRESET_MARKER_TYPE,
  normalizePromptPresetMarkerType,
  promptPresetSectionMarkerType,
  promptPresetSectionsInOrder,
} from "../../../engine/prompt-presets/prompt-preset-section-policy";

export interface PromptPresetDraftState {
  title: string;
  summary: string;
  systemPrompt: string;
  messengerPrompt: string;
  maxTokens: string;
  temperature: string;
  topP: string;
  wrapFormat: string;
  sections: PromptPresetSection[];
  groups: PromptPresetGroup[];
}

export const EMPTY_PROMPT_PRESET_DRAFT: PromptPresetDraftState = {
  title: "",
  summary: "",
  systemPrompt: "",
  messengerPrompt: "",
  maxTokens: "",
  temperature: "",
  topP: "",
  wrapFormat: "",
  sections: [],
  groups: [],
};

let draftIdCounter = 0;

function createDraftId(prefix: string) {
  draftIdCounter += 1;
  return `${prefix}-${Date.now()}-${draftIdCounter}`;
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      cleanSection.markerConfig = { type: markerType };
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
    identifier: isMarker ? markerType : section.identifier,
    isMarker,
    markerConfig: isMarker ? { type: markerType } : null,
  };
}

export function canSavePromptPresetDraft(draft: PromptPresetDraftState) {
  return (
    draft.title.trim().length > 0 &&
    (draft.systemPrompt.trim().length > 0 || draft.sections.length > 0)
  );
}

function cleanDraftSystemPrompt(systemPrompt: string, sections: readonly PromptPresetSection[]) {
  const trimmedSystemPrompt = systemPrompt.trim();
  if (trimmedSystemPrompt || sections.length === 0) return trimmedSystemPrompt;
  return DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT;
}

export function draftFromPromptPreset(preset: PromptPresetRecord): PromptPresetDraftState {
  return {
    title: preset.title,
    summary: preset.summary ?? "",
    systemPrompt: preset.systemPrompt,
    messengerPrompt: preset.messengerPrompt ?? "",
    maxTokens: preset.sampling?.maxTokens?.toString() ?? "",
    temperature: preset.sampling?.temperature?.toString() ?? "",
    topP: preset.sampling?.topP?.toString() ?? "",
    wrapFormat: preset.wrapFormat ?? "",
    sections: cloneSections(promptPresetSectionsInOrder(preset.sections, preset.sectionOrder)),
    groups: cloneGroups(rowsInOrder(preset.groups, preset.groupOrder)),
  };
}

export function promptPresetDraftToInput(draft: PromptPresetDraftState): PromptPresetInput {
  const sampling = {
    maxTokens: optionalNumber(draft.maxTokens),
    temperature: optionalNumber(draft.temperature),
    topP: optionalNumber(draft.topP),
  };
  const sections = cleanSections(draft.sections);
  const groups = cleanGroups(draft.groups);
  const systemPrompt = cleanDraftSystemPrompt(draft.systemPrompt, sections);

  return {
    title: draft.title.trim(),
    summary: draft.summary.trim() || null,
    systemPrompt,
    messengerPrompt: draft.messengerPrompt.trim() || null,
    sampling,
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
