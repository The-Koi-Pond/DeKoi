import type {
  PromptPresetChoiceBlock,
  PromptPresetChoiceSelection,
  PromptPresetChoiceSelections,
  PromptPresetGroup,
  PromptPresetParameters,
  PromptPresetRecord,
  PromptPresetSampling,
  PromptPresetSection,
  PromptPresetSectionRole,
  PromptPresetVisibilityRule,
} from "../contracts/types/prompt-presets";

function cleanSamplingNumber(value: number | null | undefined, min: number, max: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

function cleanNullableNumber(value: unknown, min: number, max: number, round = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.max(min, Math.min(max, value));
  return round ? Math.round(normalized) : normalized;
}

function cleanNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export function normalizePromptPresetSampling(
  value: PromptPresetSampling | null | undefined,
): PromptPresetSampling | null {
  if (!value) return null;

  const maxTokens = cleanSamplingNumber(value.maxTokens, 1, 131_072);
  const temperature = cleanSamplingNumber(value.temperature, 0, 2);
  const topP = cleanSamplingNumber(value.topP, 0, 1);

  const sampling: PromptPresetSampling = {};
  if (maxTokens !== null) sampling.maxTokens = Math.round(maxTokens);
  if (temperature !== null) sampling.temperature = temperature;
  if (topP !== null) sampling.topP = topP;

  return Object.keys(sampling).length > 0 ? sampling : null;
}

export function normalizePromptPresetParameters(value: unknown): PromptPresetParameters | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const parameters: PromptPresetParameters = {};
  const maxTokens = cleanNullableNumber(source.maxTokens, 1, 131_072, true);
  const temperature = cleanNullableNumber(source.temperature, 0, 2);
  const topP = cleanNullableNumber(source.topP, 0, 1);
  const topK = cleanNullableNumber(source.topK, 0, 1_000, true);
  const minP = cleanNullableNumber(source.minP, 0, 1);
  const maxContext = cleanNullableNumber(source.maxContext, 1, 2_000_000, true);
  const frequencyPenalty = cleanNullableNumber(source.frequencyPenalty, -2, 2);
  const presencePenalty = cleanNullableNumber(source.presencePenalty, -2, 2);
  const reasoningEffort = readNullableString(source.reasoningEffort);
  const verbosity = readNullableString(source.verbosity);
  const serviceTier = readNullableString(source.serviceTier);
  const assistantPrefill = readNullableString(source.assistantPrefill);
  const customThinkingTags = readNullableString(source.customThinkingTags);
  const customParameters = isRecord(source.customParameters)
    ? { ...source.customParameters }
    : null;
  const enabledParameters = normalizeBooleanRecord(source.enabledParameters);
  const squashSystemMessages = cleanNullableBoolean(source.squashSystemMessages);
  const showThoughts = cleanNullableBoolean(source.showThoughts);
  const useMaxContext = cleanNullableBoolean(source.useMaxContext);
  const stopSequences = normalizeStringArray(source.stopSequences);
  const strictRoleFormatting = cleanNullableBoolean(source.strictRoleFormatting);
  const singleUserMessage = cleanNullableBoolean(source.singleUserMessage);

  if (maxTokens !== null) parameters.maxTokens = maxTokens;
  if (temperature !== null) parameters.temperature = temperature;
  if (topP !== null) parameters.topP = topP;
  if (topK !== null) parameters.topK = topK;
  if (minP !== null) parameters.minP = minP;
  if (maxContext !== null) parameters.maxContext = maxContext;
  if (frequencyPenalty !== null) parameters.frequencyPenalty = frequencyPenalty;
  if (presencePenalty !== null) parameters.presencePenalty = presencePenalty;
  if (reasoningEffort !== null) parameters.reasoningEffort = reasoningEffort;
  if (verbosity !== null) parameters.verbosity = verbosity;
  if (serviceTier !== null) parameters.serviceTier = serviceTier;
  if (assistantPrefill !== null) parameters.assistantPrefill = assistantPrefill;
  if (customThinkingTags !== null) parameters.customThinkingTags = customThinkingTags;
  if (customParameters !== null) parameters.customParameters = customParameters;
  if (enabledParameters !== null) parameters.enabledParameters = enabledParameters;
  if (squashSystemMessages !== null) parameters.squashSystemMessages = squashSystemMessages;
  if (showThoughts !== null) parameters.showThoughts = showThoughts;
  if (useMaxContext !== null) parameters.useMaxContext = useMaxContext;
  if (stopSequences.length > 0) parameters.stopSequences = stopSequences;
  if (strictRoleFormatting !== null) parameters.strictRoleFormatting = strictRoleFormatting;
  if (singleUserMessage !== null) parameters.singleUserMessage = singleUserMessage;

  return Object.keys(parameters).length > 0 ? parameters : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readNullableString(value: unknown) {
  const trimmed = readString(value).trim();
  return trimmed ? trimmed : null;
}

function readNullableRawString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readTrimmedString(value: unknown) {
  return readString(value).trim();
}

function readTimestamp(value: unknown, fallback: string) {
  const timestamp = readString(value).trim();
  return timestamp && !Number.isNaN(Date.parse(timestamp)) ? timestamp : fallback;
}

export function normalizeStringArray(value: unknown): string[] {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return [];

  const strings: string[] = [];
  for (const item of source) {
    const stringValue = readTrimmedString(item);
    if (stringValue) strings.push(stringValue);
  }

  return strings;
}

export function normalizeStringRecord(value: unknown): Record<string, string> {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return {};

  const record: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim();
    if (!key || typeof rawValue !== "string") continue;
    record[key] = rawValue.trim();
  }

  return record;
}

function normalizeBooleanRecord(value: unknown): Record<string, boolean> | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const record: Record<string, boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim();
    if (!key || typeof rawValue !== "boolean") continue;
    record[key] = rawValue;
  }

  return Object.keys(record).length > 0 ? record : null;
}

function normalizeChoiceSelection(value: unknown): PromptPresetChoiceSelection | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (!Array.isArray(value)) return null;

  const selections: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const trimmed = readTrimmedString(item);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    selections.push(trimmed);
  }

  return selections.length > 0 ? selections : null;
}

export function normalizeChoiceSelectionRecord(value: unknown): PromptPresetChoiceSelections {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return {};

  const record: PromptPresetChoiceSelections = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim();
    const selection = normalizeChoiceSelection(rawValue);
    if (key && selection !== null) record[key] = selection;
  }

  return record;
}

export function normalizeUnknownArray(value: unknown): unknown[] {
  const source = parseJsonIfString(value);
  return Array.isArray(source) ? [...source] : [];
}

function normalizeChoiceOptions(value: unknown): PromptPresetChoiceBlock["options"] {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return [];

  const seenOptionIds = new Set<string>();
  const options: PromptPresetChoiceBlock["options"] = [];

  for (const item of source) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    const label = readTrimmedString(item.label);
    if (!id || !label || seenOptionIds.has(id) || typeof item.value !== "string") continue;

    const option: PromptPresetChoiceBlock["options"][number] = {
      id,
      label,
      value: item.value.trim(),
    };
    const description = readNullableString(item.description);
    if (description !== null) option.description = description;

    seenOptionIds.add(id);
    options.push(option);
  }

  return options;
}

function normalizeVisibilityRule(value: unknown): PromptPresetVisibilityRule | null {
  if (!isRecord(value)) return null;

  const variableName = readTrimmedString(value.variableName);
  const values = normalizeStringArray(value.values);
  if (!variableName || values.length === 0) return null;

  return { variableName, values };
}

export function normalizePromptPresetChoiceBlocks(
  value: unknown,
  defaultChoices: PromptPresetChoiceSelections = {},
): PromptPresetChoiceBlock[] {
  if (!Array.isArray(value)) return [];

  const seenBlockIds = new Set<string>();
  const seenVariableNames = new Set<string>();
  const blocks: PromptPresetChoiceBlock[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    const variableName = readTrimmedString(item.variableName);
    if (!id || !variableName || seenBlockIds.has(id) || seenVariableNames.has(variableName)) {
      continue;
    }

    const options = normalizeChoiceOptions(item.options);
    if (options.length === 0) continue;

    const defaultChoiceValue = defaultChoices[variableName];
    const firstDefaultChoice = Array.isArray(defaultChoiceValue)
      ? defaultChoiceValue[0]
      : defaultChoiceValue;
    const defaultOptionByChoice =
      typeof firstDefaultChoice === "string"
        ? options.find(
            (option) => option.value === firstDefaultChoice || option.id === firstDefaultChoice,
          )
        : null;
    const defaultOptionId = defaultOptionByChoice?.id ?? readTrimmedString(item.defaultOptionId);
    const normalizedDefaultOptionId = options.some((option) => option.id === defaultOptionId)
      ? defaultOptionId
      : options[0]?.id;

    seenBlockIds.add(id);
    seenVariableNames.add(variableName);
    const question = readNullableString(item.question);
    const label = readTrimmedString(item.label) || question || variableName;
    const block: PromptPresetChoiceBlock = {
      id,
      variableName,
      label,
      options,
    };
    const presetId = readNullableString(item.presetId);
    const separator = readNullableRawString(item.separator);
    const displayMode =
      item.displayMode === "buttons" ||
      item.displayMode === "listbox" ||
      item.displayMode === "auto"
        ? item.displayMode
        : null;
    const optionSort =
      item.optionSort === "alphabetical" || item.optionSort === "manual" ? item.optionSort : null;
    const sortOrder = cleanNullableNumber(item.sortOrder, 0, Number.MAX_SAFE_INTEGER, true);
    const createdAt = readNullableString(item.createdAt);
    const visibilityRule = normalizeVisibilityRule(item.visibilityRule);

    if (presetId !== null) block.presetId = presetId;
    if (question !== null) block.question = question;
    if (normalizedDefaultOptionId) block.defaultOptionId = normalizedDefaultOptionId;
    if (typeof item.multiSelect === "boolean" || typeof item.multiSelect === "string") {
      block.multiSelect = readBooleanLike(item.multiSelect, false);
    }
    if (separator !== null) block.separator = separator;
    if (typeof item.randomPick === "boolean" || typeof item.randomPick === "string") {
      block.randomPick = readBooleanLike(item.randomPick, false);
    }
    if (displayMode !== null) block.displayMode = displayMode;
    if (optionSort !== null) block.optionSort = optionSort;
    if (sortOrder !== null) block.sortOrder = sortOrder;
    if (createdAt !== null) block.createdAt = createdAt;
    if (visibilityRule !== null) block.visibilityRule = visibilityRule;

    blocks.push(block);
  }

  return blocks;
}

export function normalizePromptPresetChoiceSelections(
  value: unknown,
): PromptPresetChoiceSelections {
  return normalizeChoiceSelectionRecord(value);
}

function getPromptPresetChoiceBlocksInOrder(preset: PromptPresetRecord) {
  if (preset.variableOrder.length === 0) return preset.choiceBlocks;

  const orderByBlockId = new Map(preset.variableOrder.map((blockId, index) => [blockId, index]));
  return [...preset.choiceBlocks].sort((left, right) => {
    const leftOrder = orderByBlockId.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByBlockId.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function choiceSelectionValues(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelection | null | undefined,
): string[] {
  const candidates = Array.isArray(selection) ? selection : selection ? [selection] : [];
  const values: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const option =
      block.options.find((currentOption) => currentOption.value === trimmed) ??
      block.options.find((currentOption) => currentOption.id === trimmed);
    if (!option || seen.has(option.value)) continue;

    seen.add(option.value);
    values.push(option.value);
  }

  return values;
}

function choiceOptionValues(block: PromptPresetChoiceBlock) {
  return block.options.map((option) => option.value);
}

function defaultChoiceSelection(
  preset: PromptPresetRecord,
  block: PromptPresetChoiceBlock,
): PromptPresetChoiceSelection | null {
  const presetDefault = preset.defaultChoices[block.variableName];
  if (presetDefault !== undefined) return presetDefault;
  if (block.defaultOptionId) return block.defaultOptionId;
  return block.options[0]?.value ?? null;
}

function resolvePromptPresetChoiceValues({
  block,
  preset,
  selection,
  useRandomOptions = false,
}: {
  block: PromptPresetChoiceBlock;
  preset: PromptPresetRecord;
  selection: PromptPresetChoiceSelection | null | undefined;
  useRandomOptions?: boolean;
}) {
  const selectedValues = choiceSelectionValues(block, selection);
  if (selectedValues.length > 0) return selectedValues;

  if (useRandomOptions) return choiceOptionValues(block);

  const defaultValues = choiceSelectionValues(block, defaultChoiceSelection(preset, block));
  return defaultValues.length > 0
    ? defaultValues
    : block.options[0]
      ? [block.options[0].value]
      : [];
}

export function isPromptPresetChoiceBlockVisible({
  block,
  preset,
  selections,
}: {
  block: PromptPresetChoiceBlock;
  preset: PromptPresetRecord;
  selections?: PromptPresetChoiceSelections | null;
}) {
  if (!block.visibilityRule) return true;

  const controller = preset.choiceBlocks.find(
    (choiceBlock) => choiceBlock.variableName === block.visibilityRule?.variableName,
  );
  if (!controller) return false;

  const selectedControllerValues = resolvePromptPresetChoiceValues({
    block: controller,
    preset,
    selection: selections?.[controller.variableName],
  });
  if (selectedControllerValues.length === 0) return false;

  return selectedControllerValues.some((value) => block.visibilityRule?.values.includes(value));
}

function normalizeSectionRole(value: unknown): PromptPresetSectionRole {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}

function normalizeMarkerConfig(value: unknown) {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const type = readTrimmedString(source.type);
  return type ? { type } : null;
}

export function normalizePromptPresetSections(value: unknown): PromptPresetSection[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const sections: PromptPresetSection[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    if (!id || seenIds.has(id)) continue;

    const name = readTrimmedString(item.name) || id;
    const section: PromptPresetSection = {
      id,
      identifier: readTrimmedString(item.identifier) || id,
      name,
      content: readString(item.content).trim(),
      role: normalizeSectionRole(item.role),
      enabled: readBooleanLike(item.enabled, true),
      isMarker: readBooleanLike(item.isMarker, false),
    };
    const presetId = readNullableString(item.presetId);
    const groupId = readNullableString(item.groupId);
    const markerConfig = normalizeMarkerConfig(item.markerConfig);
    const injectionPosition = readNullableString(item.injectionPosition);
    const injectionDepth = cleanNullableNumber(
      item.injectionDepth,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      true,
    );
    const injectionOrder = cleanNullableNumber(
      item.injectionOrder,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      true,
    );
    const xmlTagName = readNullableString(item.xmlTagName);

    if (presetId !== null) section.presetId = presetId;
    if (groupId !== null) section.groupId = groupId;
    if (markerConfig !== null) section.markerConfig = markerConfig;
    if (injectionPosition !== null) section.injectionPosition = injectionPosition;
    if (injectionDepth !== null) section.injectionDepth = injectionDepth;
    if (injectionOrder !== null) section.injectionOrder = injectionOrder;
    if (typeof item.wrapInXml === "boolean" || typeof item.wrapInXml === "string") {
      section.wrapInXml = readBooleanLike(item.wrapInXml, false);
    }
    if (xmlTagName !== null) section.xmlTagName = xmlTagName;
    if (typeof item.forbidOverrides === "boolean" || typeof item.forbidOverrides === "string") {
      section.forbidOverrides = readBooleanLike(item.forbidOverrides, false);
    }

    seenIds.add(id);
    sections.push(section);
  }

  return sections;
}

export function normalizePromptPresetGroups(value: unknown): PromptPresetGroup[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const groups: PromptPresetGroup[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    if (!id || seenIds.has(id)) continue;

    const group: PromptPresetGroup = {
      id,
      name: readTrimmedString(item.name) || id,
    };
    const presetId = readNullableString(item.presetId);
    const parentGroupId = readNullableString(item.parentGroupId);
    const order = cleanNullableNumber(
      item.order,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      true,
    );
    const createdAt = readNullableString(item.createdAt);

    if (presetId !== null) group.presetId = presetId;
    if (parentGroupId !== null) group.parentGroupId = parentGroupId;
    if (order !== null) group.order = order;
    if (typeof item.enabled === "boolean" || typeof item.enabled === "string") {
      group.enabled = readBooleanLike(item.enabled, true);
    }
    if (createdAt !== null) group.createdAt = createdAt;

    seenIds.add(id);
    groups.push(group);
  }

  return groups;
}

function normalizePromptPresetRecordFromParts({
  choiceBlocks,
  createdAt,
  defaultChoices,
  folderId = null,
  groupOrder,
  groups,
  id,
  isDefault = false,
  parameters,
  schemaVersion = 1,
  sectionOrder,
  sections,
  summary,
  systemPrompt,
  title,
  updatedAt,
  variableGroups,
  variableOrder,
  variableValues,
  wrapFormat = null,
  author = null,
  messengerPrompt = null,
}: {
  id: string;
  schemaVersion?: 1;
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
  isDefault?: boolean;
  author?: string | null;
  folderId?: string | null;
  sections: PromptPresetSection[];
  groups: PromptPresetGroup[];
  choiceBlocks: PromptPresetChoiceBlock[];
  createdAt: string;
  updatedAt: string;
}): PromptPresetRecord | null {
  if (!id) return null;

  const normalizedParameters = parameters ?? null;
  const sampling = normalizePromptPresetSampling(normalizedParameters);
  const resolvedMessengerPrompt = messengerPrompt?.trim() || null;
  const resolvedSystemPrompt = systemPrompt.trim() || "Write the next response in character.";

  return {
    id,
    schemaVersion,
    title: title.trim() || "Untitled preset",
    summary: summary?.trim() || null,
    systemPrompt: resolvedSystemPrompt,
    messengerPrompt: resolvedMessengerPrompt,
    sampling,
    parameters: normalizedParameters,
    sectionOrder,
    groupOrder,
    variableOrder,
    variableGroups,
    variableValues,
    defaultChoices,
    wrapFormat,
    isDefault,
    author,
    folderId,
    sections,
    groups,
    choiceBlocks,
    createdAt,
    updatedAt,
  };
}

export function resolvePromptPresetChoiceVariables({
  preset,
  selections,
}: {
  preset: PromptPresetRecord | null | undefined;
  selections?: PromptPresetChoiceSelections | null;
}) {
  const variables: Record<string, string> = { ...(preset?.variableValues ?? {}) };
  const variableNames: string[] = [];
  if (!preset) return { variables, variableNames };

  variableNames.push(...Object.keys(preset.variableValues));
  const normalizedSelections = selections ?? {};
  for (const block of getPromptPresetChoiceBlocksInOrder(preset)) {
    const visible = isPromptPresetChoiceBlockVisible({
      block,
      preset,
      selections: normalizedSelections,
    });
    const hasSelection = Object.prototype.hasOwnProperty.call(
      normalizedSelections,
      block.variableName,
    );
    const selectedValues = resolvePromptPresetChoiceValues({
      block,
      preset,
      selection: visible && hasSelection ? normalizedSelections[block.variableName] : null,
      useRandomOptions: visible && block.randomPick === true && !hasSelection,
    });
    if (selectedValues.length === 0) continue;

    variables[block.variableName] =
      block.multiSelect && !block.randomPick
        ? selectedValues.join(block.separator ?? ", ")
        : ((block.randomPick
            ? selectedValues[Math.floor(Math.random() * selectedValues.length)]
            : selectedValues[0]) ?? "");
    variableNames.push(block.variableName);
  }

  return { variables, variableNames };
}

export function normalizePromptPresetRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;

  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const systemPrompt = readString(value.systemPrompt).trim();
  if (!id || !systemPrompt) return null;

  const now = new Date().toISOString();
  const title = readString(value.title).trim() || "Untitled preset";
  const parameters =
    normalizePromptPresetParameters(value.parameters) ??
    normalizePromptPresetParameters(value.sampling);
  const sectionOrder = normalizeStringArray(value.sectionOrder);
  const groupOrder = normalizeStringArray(value.groupOrder);
  const variableOrder = normalizeStringArray(value.variableOrder);
  const variableGroups = normalizeUnknownArray(value.variableGroups);
  const variableValues = normalizeStringRecord(value.variableValues);
  const defaultChoices = normalizeChoiceSelectionRecord(value.defaultChoices);
  const sections = normalizePromptPresetSections(value.sections);
  const groups = normalizePromptPresetGroups(value.groups);
  const messengerPrompt = readNullableString(value.messengerPrompt);

  return normalizePromptPresetRecordFromParts({
    id,
    schemaVersion: 1,
    title,
    summary: readNullableString(value.summary),
    systemPrompt,
    messengerPrompt,
    parameters,
    sectionOrder,
    groupOrder,
    variableOrder,
    variableGroups,
    variableValues,
    defaultChoices,
    wrapFormat: readNullableString(value.wrapFormat),
    isDefault: readBooleanLike(value.isDefault, false),
    author: readNullableString(value.author),
    folderId: readNullableString(value.folderId),
    sections,
    groups,
    choiceBlocks: normalizePromptPresetChoiceBlocks(value.choiceBlocks, defaultChoices),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  });
}
