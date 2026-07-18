import type { PromptPresetSection } from "../contracts/types/prompt-presets";
import { PROMPT_PRESET_NUMERIC_CONSTRAINTS } from "./prompt-preset-parameter-contract";

export type PromptPresetNestedFormat = "native" | "dekoi_preset" | "marinara_preset";
export type PromptPresetNestedKind = "sections" | "groups" | "choiceBlocks";

const MAX_CHOICE_OPTIONS = 1_000;
const MAX_DEFAULT_SELECTIONS = 1_000;
const INVALID_BOOLEAN = Symbol("invalid prompt preset boolean");

const SECTION_KEYS = new Set([
  "id",
  "identifier",
  "name",
  "content",
  "role",
  "enabled",
  "isMarker",
  "presetId",
  "groupId",
  "markerConfig",
  "injectionPosition",
  "injectionDepth",
  "injectionOrder",
  "wrapInXml",
  "xmlTagName",
  "forbidOverrides",
]);
const GROUP_KEYS = new Set([
  "id",
  "name",
  "presetId",
  "parentGroupId",
  "order",
  "enabled",
  "createdAt",
]);
const DEKOI_CHOICE_BLOCK_KEYS = new Set([
  "id",
  "variableName",
  "options",
  "presetId",
  "question",
  "label",
  "multiSelect",
  "separator",
  "randomPick",
  "displayMode",
  "optionSort",
  "sortOrder",
  "createdAt",
]);
const MARINARA_CHOICE_BLOCK_KEYS = new Set(
  [...DEKOI_CHOICE_BLOCK_KEYS].filter((key) => key !== "label"),
);
const DEKOI_OPTION_KEYS = new Set(["id", "label", "value", "description"]);
const MARINARA_OPTION_KEYS = new Set(["id", "label", "value"]);
const MARKER_CONFIG_KEYS = new Set([
  "type",
  "characterFields",
  "lorebookFormat",
  "chatHistoryOptions",
  "agentType",
]);
const CHAT_HISTORY_OPTION_KEYS = new Set(["maxMessages", "includeSystemMessages"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(record).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function readRequiredBoolean(value: unknown, format: PromptPresetNestedFormat) {
  if (typeof value === "boolean") return value;
  if (format === "marinara_preset" && value === "true") return true;
  if (format === "marinara_preset" && value === "false") return false;
  return INVALID_BOOLEAN;
}

function readOptionalBoolean(value: unknown, format: PromptPresetNestedFormat) {
  if (value === undefined || (format === "marinara_preset" && value === null)) return undefined;
  return readRequiredBoolean(value, format);
}

function isNullableNumberWithin(
  value: unknown,
  constraint: { minimum: number; maximum: number; integer?: boolean },
) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= constraint.minimum &&
      value <= constraint.maximum &&
      (!constraint.integer || Number.isInteger(value)))
  );
}

export function readPromptPresetMarkerConfig(
  value: unknown,
  format: PromptPresetNestedFormat,
): NonNullable<PromptPresetSection["markerConfig"]> | null {
  const source = format === "marinara_preset" ? parseJson(value) : value;
  if (!isRecord(source) || !hasOnlyKeys(source, MARKER_CONFIG_KEYS)) return null;
  if (!isNonEmptyString(source.type)) return null;
  if (
    source.characterFields !== undefined &&
    (!Array.isArray(source.characterFields) || !source.characterFields.every(isNonEmptyString))
  )
    return null;
  if (
    source.lorebookFormat !== undefined &&
    source.lorebookFormat !== "full" &&
    source.lorebookFormat !== "worldbook_only" &&
    source.lorebookFormat !== "character_only"
  )
    return null;
  if (source.agentType !== undefined && typeof source.agentType !== "string") return null;
  if (source.chatHistoryOptions !== undefined) {
    const options = source.chatHistoryOptions;
    if (!isRecord(options) || !hasOnlyKeys(options, CHAT_HISTORY_OPTION_KEYS)) return null;
    if (
      options.maxMessages !== undefined &&
      (typeof options.maxMessages !== "number" ||
        !Number.isInteger(options.maxMessages) ||
        options.maxMessages < 1)
    )
      return null;
    if (
      options.includeSystemMessages !== undefined &&
      typeof options.includeSystemMessages !== "boolean"
    )
      return null;
  }
  const markerConfig: NonNullable<PromptPresetSection["markerConfig"]> = {
    type: source.type.trim(),
  };
  if (Array.isArray(source.characterFields)) {
    markerConfig.characterFields = source.characterFields;
  }
  if (
    source.lorebookFormat === "full" ||
    source.lorebookFormat === "worldbook_only" ||
    source.lorebookFormat === "character_only"
  ) {
    markerConfig.lorebookFormat = source.lorebookFormat;
  }
  if (isRecord(source.chatHistoryOptions)) {
    markerConfig.chatHistoryOptions = {};
    if (typeof source.chatHistoryOptions.maxMessages === "number") {
      markerConfig.chatHistoryOptions.maxMessages = source.chatHistoryOptions.maxMessages;
    }
    if (typeof source.chatHistoryOptions.includeSystemMessages === "boolean") {
      markerConfig.chatHistoryOptions.includeSystemMessages =
        source.chatHistoryOptions.includeSystemMessages;
    }
  }
  if (typeof source.agentType === "string") markerConfig.agentType = source.agentType;
  return markerConfig;
}

function readSection(
  row: Record<string, unknown>,
  format: PromptPresetNestedFormat,
): Record<string, unknown> | null {
  const enabled = readRequiredBoolean(row.enabled, format);
  const isMarker = readRequiredBoolean(row.isMarker, format);
  const wrapInXml = readOptionalBoolean(row.wrapInXml, format);
  const forbidOverrides = readOptionalBoolean(row.forbidOverrides, format);
  if (
    !hasOnlyKeys(row, SECTION_KEYS) ||
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.identifier) ||
    !isNonEmptyString(row.name) ||
    typeof row.content !== "string" ||
    (row.role !== "system" && row.role !== "user" && row.role !== "assistant") ||
    enabled === INVALID_BOOLEAN ||
    isMarker === INVALID_BOOLEAN ||
    (row.presetId !== undefined && !isNullableString(row.presetId)) ||
    (row.groupId !== undefined && !isNullableString(row.groupId)) ||
    (row.injectionPosition !== undefined && !isNullableString(row.injectionPosition)) ||
    !isNullableNumberWithin(
      row.injectionDepth,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionDepth,
    ) ||
    !isNullableNumberWithin(
      row.injectionOrder,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionOrder,
    ) ||
    wrapInXml === INVALID_BOOLEAN ||
    (row.xmlTagName !== undefined && !isNullableString(row.xmlTagName)) ||
    forbidOverrides === INVALID_BOOLEAN
  )
    return null;

  const section: Record<string, unknown> = { ...row, enabled, isMarker };
  if (wrapInXml === undefined) delete section.wrapInXml;
  else section.wrapInXml = wrapInXml;
  if (forbidOverrides === undefined) delete section.forbidOverrides;
  else section.forbidOverrides = forbidOverrides;
  if (row.markerConfig === undefined || row.markerConfig === null) return section;
  const markerConfig = readPromptPresetMarkerConfig(row.markerConfig, format);
  return markerConfig ? { ...section, markerConfig } : null;
}

function readGroup(
  row: Record<string, unknown>,
  format: PromptPresetNestedFormat,
): Record<string, unknown> | null {
  const enabled = readOptionalBoolean(row.enabled, format);
  if (
    !hasOnlyKeys(row, GROUP_KEYS) ||
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.name) ||
    (row.presetId !== undefined && !isNullableString(row.presetId)) ||
    (row.parentGroupId !== undefined && !isNullableString(row.parentGroupId)) ||
    !isNullableNumberWithin(row.order, PROMPT_PRESET_NUMERIC_CONSTRAINTS.groupOrder) ||
    enabled === INVALID_BOOLEAN ||
    (row.createdAt !== undefined && !isNullableString(row.createdAt))
  )
    return null;
  const group = { ...row };
  if (enabled === undefined) delete group.enabled;
  else group.enabled = enabled;
  return group;
}

function readOptions(value: unknown, format: PromptPresetNestedFormat) {
  const source = format === "marinara_preset" ? parseJson(value) : value;
  if (!Array.isArray(source) || source.length === 0 || source.length > MAX_CHOICE_OPTIONS)
    return null;
  const allowed = format === "marinara_preset" ? MARINARA_OPTION_KEYS : DEKOI_OPTION_KEYS;
  if (
    !source.every(
      (option) =>
        isRecord(option) &&
        hasOnlyKeys(option, allowed) &&
        isNonEmptyString(option.id) &&
        isNonEmptyString(option.label) &&
        typeof option.value === "string" &&
        (option.description === undefined || isNullableString(option.description)),
    )
  )
    return null;
  return source;
}

function readChoiceBlock(
  row: Record<string, unknown>,
  format: PromptPresetNestedFormat,
): Record<string, unknown> | null {
  const allowed =
    format === "marinara_preset" ? MARINARA_CHOICE_BLOCK_KEYS : DEKOI_CHOICE_BLOCK_KEYS;
  const options = readOptions(row.options, format);
  const multiSelect = readOptionalBoolean(row.multiSelect, format);
  const randomPick = readOptionalBoolean(row.randomPick, format);
  if (
    !hasOnlyKeys(row, allowed) ||
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.variableName) ||
    options === null ||
    (row.presetId !== undefined && !isNullableString(row.presetId)) ||
    (row.question !== undefined && !isNullableString(row.question)) ||
    (format !== "marinara_preset" && !isNonEmptyString(row.label)) ||
    multiSelect === INVALID_BOOLEAN ||
    (row.separator !== undefined && !isNullableString(row.separator)) ||
    randomPick === INVALID_BOOLEAN ||
    (row.displayMode !== undefined &&
      row.displayMode !== null &&
      row.displayMode !== "auto" &&
      row.displayMode !== "buttons" &&
      row.displayMode !== "listbox") ||
    (row.optionSort !== undefined &&
      row.optionSort !== null &&
      row.optionSort !== "manual" &&
      row.optionSort !== "alphabetical") ||
    !isNullableNumberWithin(row.sortOrder, PROMPT_PRESET_NUMERIC_CONSTRAINTS.choiceSortOrder) ||
    (row.createdAt !== undefined && !isNullableString(row.createdAt))
  )
    return null;
  const block: Record<string, unknown> = {
    ...row,
    ...(format === "marinara_preset"
      ? { label: (typeof row.question === "string" && row.question.trim()) || row.variableName }
      : {}),
    options,
  };
  if (multiSelect === undefined) delete block.multiSelect;
  else block.multiSelect = multiSelect;
  if (randomPick === undefined) delete block.randomPick;
  else block.randomPick = randomPick;
  return block;
}

/** Validates one complete nested collection and decodes only Marinara JSON columns. */
export function readPromptPresetNestedRecords(
  value: unknown,
  kind: PromptPresetNestedKind,
  format: PromptPresetNestedFormat,
): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  const records: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const record =
      kind === "sections"
        ? readSection(item, format)
        : kind === "groups"
          ? readGroup(item, format)
          : readChoiceBlock(item, format);
    if (!record) return null;
    records.push(record);
  }
  return records;
}

function exactOptionSelection(value: unknown) {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.kind === "option" &&
    isNonEmptyString(value.optionId)
  );
}

function exactChoiceSelection(value: unknown) {
  return (
    isNonEmptyString(value) ||
    exactOptionSelection(value) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= MAX_DEFAULT_SELECTIONS &&
      value.every((item) => isNonEmptyString(item) || exactOptionSelection(item)))
  );
}

/** Strict shape guard for native and package default-choice maps. */
export function promptPresetChoiceSelectionRecordIsValid(
  value: unknown,
  allowJsonString: boolean,
): boolean {
  const source = allowJsonString ? parseJson(value) : value;
  return (
    isRecord(source) &&
    Object.entries(source).every(
      ([key, selection]) => isNonEmptyString(key) && exactChoiceSelection(selection),
    )
  );
}
