import type { PromptPresetGroup, PromptPresetSection } from "../contracts/types/prompt-presets";

export const PROMPT_PRESET_MARKER_TYPES = [
  "chat_history",
  "chat_summary",
  "lorebook",
  "world_info_before",
  "world_info_after",
  "persona",
  "character",
  "dialogue_examples",
] as const;

export const DEFAULT_PROMPT_PRESET_MARKER_TYPE = "chat_history";

const promptPresetMarkerTypeSet = new Set<string>(PROMPT_PRESET_MARKER_TYPES);

export function normalizePromptPresetMarkerType(value: string | null | undefined) {
  const markerType = value?.trim() ?? "";
  return promptPresetMarkerTypeSet.has(markerType) ? markerType : DEFAULT_PROMPT_PRESET_MARKER_TYPE;
}

export function promptPresetSectionsInOrder(
  sections: readonly PromptPresetSection[],
  sectionOrder: readonly string[],
) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const orderedIds = new Set<string>();
  const orderedSections = sectionOrder.flatMap((sectionId) => {
    if (orderedIds.has(sectionId)) return [];

    const section = sectionById.get(sectionId);
    if (section) orderedIds.add(sectionId);
    return section ? [section] : [];
  });
  const remainingSections = sections
    .filter((section) => !orderedIds.has(section.id))
    .sort((left, right) => (left.injectionOrder ?? 0) - (right.injectionOrder ?? 0));

  return [...orderedSections, ...remainingSections];
}

export function promptPresetSectionIsEnabled(
  section: PromptPresetSection,
  groupById: ReadonlyMap<string, PromptPresetGroup>,
) {
  if (!section.enabled) return false;
  if (!section.groupId) return true;

  const group = groupById.get(section.groupId);
  return group?.enabled !== false;
}

export function promptPresetSectionMarkerType(section: PromptPresetSection) {
  return section.markerConfig?.type?.trim() || section.identifier.trim();
}

export function promptPresetHasEnabledMarker(
  sections: readonly PromptPresetSection[],
  groups: readonly PromptPresetGroup[],
  markerType: string,
) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return sections.some(
    (section) =>
      promptPresetSectionIsEnabled(section, groupById) &&
      section.isMarker &&
      promptPresetSectionMarkerType(section) === markerType,
  );
}

export function promptPresetSectionUsesDepthInsertion(section: PromptPresetSection) {
  return (
    section.injectionPosition === "depth" ||
    section.injectionPosition === "at-depth" ||
    section.injectionPosition === "at_depth"
  );
}
