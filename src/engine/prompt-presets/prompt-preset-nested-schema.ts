import type { PromptPresetSection } from "../contracts/types/prompt-presets";
import { PROMPT_PRESET_NUMERIC_CONSTRAINTS } from "./prompt-preset-parameter-contract";

export type PromptPresetNestedFormat = "native" | "dekoi_preset" | "marinara_preset";
export type PromptPresetNestedKind = "sections" | "groups" | "choiceBlocks";

const MAX_CHOICE_OPTIONS = 1_000;
const MAX_DEFAULT_SELECTIONS = 1_000;
const INVALID_BOOLEAN = Symbol("invalid prompt preset boolean");
const INVALID_NESTED_IDENTIFIER = Symbol("invalid prompt preset nested identifier");
const INVALID_TEXT = Symbol("invalid prompt preset text");

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

function isNestedIdentifier(value: unknown, format: PromptPresetNestedFormat): value is string {
  return isNonEmptyString(value) && (format !== "native" || value === value.trim());
}

function readNestedIdentifier(value: string, format: PromptPresetNestedFormat) {
  return format === "native" ? value : value.trim();
}

function readNullableNestedIdentifier(value: unknown, format: PromptPresetNestedFormat) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return INVALID_NESTED_IDENTIFIER;
  const identifier = value.trim();
  if (!identifier) return format === "native" ? INVALID_NESTED_IDENTIFIER : undefined;
  return format === "native" && value !== identifier ? INVALID_NESTED_IDENTIFIER : identifier;
}

function readCanonicalText(value: unknown, format: PromptPresetNestedFormat, allowEmpty: boolean) {
  if (typeof value !== "string") return INVALID_TEXT;
  const text = value.trim();
  if ((!allowEmpty && !text) || (format === "native" && value !== text)) return INVALID_TEXT;
  return text;
}

function readNullableCanonicalText(value: unknown, format: PromptPresetNestedFormat) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return INVALID_TEXT;
  const text = value.trim();
  if (!text) return format === "native" ? INVALID_TEXT : null;
  return format === "native" && value !== text ? INVALID_TEXT : text;
}

function readNullableRawText(value: unknown, format: PromptPresetNestedFormat) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return INVALID_TEXT;
  if (!value.trim()) return format === "native" ? INVALID_TEXT : null;
  return value;
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
  const type = readCanonicalText(source.type, format, false);
  if (type === INVALID_TEXT) return null;
  if (
    source.characterFields !== undefined &&
    (!Array.isArray(source.characterFields) ||
      !source.characterFields.every((field) => isNestedIdentifier(field, format)))
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
    type,
  };
  if (Array.isArray(source.characterFields)) {
    markerConfig.characterFields = source.characterFields.map((field) =>
      readNestedIdentifier(field, format),
    );
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
  const presetId = readNullableNestedIdentifier(row.presetId, format);
  const groupId = readNullableNestedIdentifier(row.groupId, format);
  const identifier = readCanonicalText(row.identifier, format, false);
  const name = readCanonicalText(row.name, format, false);
  const content = readCanonicalText(row.content, format, true);
  const injectionPosition = readNullableCanonicalText(row.injectionPosition, format);
  const xmlTagName = readNullableCanonicalText(row.xmlTagName, format);
  const enabled = readRequiredBoolean(row.enabled, format);
  const isMarker = readRequiredBoolean(row.isMarker, format);
  const wrapInXml = readOptionalBoolean(row.wrapInXml, format);
  const forbidOverrides = readOptionalBoolean(row.forbidOverrides, format);
  if (
    !hasOnlyKeys(row, SECTION_KEYS) ||
    !isNestedIdentifier(row.id, format) ||
    identifier === INVALID_TEXT ||
    name === INVALID_TEXT ||
    content === INVALID_TEXT ||
    (row.role !== "system" && row.role !== "user" && row.role !== "assistant") ||
    enabled === INVALID_BOOLEAN ||
    isMarker === INVALID_BOOLEAN ||
    presetId === INVALID_NESTED_IDENTIFIER ||
    groupId === INVALID_NESTED_IDENTIFIER ||
    injectionPosition === INVALID_TEXT ||
    !isNullableNumberWithin(
      row.injectionDepth,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionDepth,
    ) ||
    !isNullableNumberWithin(
      row.injectionOrder,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionOrder,
    ) ||
    wrapInXml === INVALID_BOOLEAN ||
    xmlTagName === INVALID_TEXT ||
    forbidOverrides === INVALID_BOOLEAN
  )
    return null;

  const section: Record<string, unknown> = {
    ...row,
    id: readNestedIdentifier(row.id, format),
    identifier,
    name,
    content,
    enabled,
    isMarker,
  };
  if (presetId === undefined) delete section.presetId;
  else section.presetId = presetId;
  if (groupId === undefined) delete section.groupId;
  else section.groupId = groupId;
  if (injectionPosition !== undefined) section.injectionPosition = injectionPosition;
  if (xmlTagName !== undefined) section.xmlTagName = xmlTagName;
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
  const presetId = readNullableNestedIdentifier(row.presetId, format);
  const parentGroupId = readNullableNestedIdentifier(row.parentGroupId, format);
  const name = readCanonicalText(row.name, format, false);
  const createdAt = readNullableCanonicalText(row.createdAt, format);
  const enabled = readOptionalBoolean(row.enabled, format);
  if (
    !hasOnlyKeys(row, GROUP_KEYS) ||
    !isNestedIdentifier(row.id, format) ||
    name === INVALID_TEXT ||
    presetId === INVALID_NESTED_IDENTIFIER ||
    parentGroupId === INVALID_NESTED_IDENTIFIER ||
    !isNullableNumberWithin(row.order, PROMPT_PRESET_NUMERIC_CONSTRAINTS.groupOrder) ||
    enabled === INVALID_BOOLEAN ||
    createdAt === INVALID_TEXT
  )
    return null;
  const group: Record<string, unknown> = {
    ...row,
    id: readNestedIdentifier(row.id, format),
    name,
  };
  if (presetId === undefined) delete group.presetId;
  else group.presetId = presetId;
  if (parentGroupId === undefined) delete group.parentGroupId;
  else group.parentGroupId = parentGroupId;
  if (createdAt !== undefined) group.createdAt = createdAt;
  if (enabled === undefined) delete group.enabled;
  else group.enabled = enabled;
  return group;
}

function readOptions(value: unknown, format: PromptPresetNestedFormat) {
  const source = format === "marinara_preset" ? parseJson(value) : value;
  if (!Array.isArray(source) || source.length === 0 || source.length > MAX_CHOICE_OPTIONS)
    return null;
  const allowed = format === "marinara_preset" ? MARINARA_OPTION_KEYS : DEKOI_OPTION_KEYS;
  const options: Record<string, unknown>[] = [];
  for (const option of source) {
    if (!isRecord(option) || !hasOnlyKeys(option, allowed)) return null;
    const label = readCanonicalText(option.label, format, false);
    const optionValue = readCanonicalText(option.value, format, true);
    const description = readNullableCanonicalText(option.description, format);
    if (
      !isNestedIdentifier(option.id, format) ||
      label === INVALID_TEXT ||
      optionValue === INVALID_TEXT ||
      description === INVALID_TEXT
    )
      return null;
    const decoded: Record<string, unknown> = {
      ...option,
      id: readNestedIdentifier(option.id, format),
      label,
      value: optionValue,
    };
    if (description !== undefined) decoded.description = description;
    options.push(decoded);
  }
  return options;
}

function readChoiceBlock(
  row: Record<string, unknown>,
  format: PromptPresetNestedFormat,
): Record<string, unknown> | null {
  const allowed =
    format === "marinara_preset" ? MARINARA_CHOICE_BLOCK_KEYS : DEKOI_CHOICE_BLOCK_KEYS;
  const presetId = readNullableNestedIdentifier(row.presetId, format);
  const variableName = isNestedIdentifier(row.variableName, format)
    ? readNestedIdentifier(row.variableName, format)
    : INVALID_NESTED_IDENTIFIER;
  const question = readNullableCanonicalText(row.question, format);
  const label =
    format === "marinara_preset"
      ? question || variableName
      : readCanonicalText(row.label, format, false);
  const separator = readNullableRawText(row.separator, format);
  const createdAt = readNullableCanonicalText(row.createdAt, format);
  const options = readOptions(row.options, format);
  const multiSelect = readOptionalBoolean(row.multiSelect, format);
  const randomPick = readOptionalBoolean(row.randomPick, format);
  if (
    !hasOnlyKeys(row, allowed) ||
    !isNestedIdentifier(row.id, format) ||
    variableName === INVALID_NESTED_IDENTIFIER ||
    options === null ||
    presetId === INVALID_NESTED_IDENTIFIER ||
    question === INVALID_TEXT ||
    label === INVALID_TEXT ||
    multiSelect === INVALID_BOOLEAN ||
    separator === INVALID_TEXT ||
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
    createdAt === INVALID_TEXT
  )
    return null;
  const block: Record<string, unknown> = {
    ...row,
    id: readNestedIdentifier(row.id, format),
    variableName,
    label,
    options,
  };
  if (presetId === undefined) delete block.presetId;
  else block.presetId = presetId;
  if (question !== undefined) block.question = question;
  if (separator !== undefined) block.separator = separator;
  if (createdAt !== undefined) block.createdAt = createdAt;
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

function exactOptionSelection(value: unknown): value is { kind: "option"; optionId: string } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.kind === "option" &&
    isNonEmptyString(value.optionId)
  );
}

function exactChoiceSelectionKey(value: unknown) {
  if (isNonEmptyString(value)) return `value:${value.trim()}`;
  if (exactOptionSelection(value)) return `option:${value.optionId.trim()}`;
  return null;
}

function exactChoiceSelection(value: unknown) {
  if (exactChoiceSelectionKey(value) !== null) return true;
  if (!Array.isArray(value) || value.length > MAX_DEFAULT_SELECTIONS) return false;

  const keys = value.map(exactChoiceSelectionKey);
  return keys.every((key) => key !== null) && new Set(keys).size === keys.length;
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
