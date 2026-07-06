import type { CharacterRecord } from "../contracts/types/character";
import type {
  LorebookRecord,
  LoreInsertionStrategy,
  LoreSourceKind,
} from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { PersonaRecord } from "../contracts/types/persona";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import type { AppSettings } from "../contracts/types/app-settings";
import {
  advanceLoreRuntimeStateForEvaluation,
  activateLorebookEntriesWithWarnings,
  applyTokenBudget,
  buildMatchSources,
  buildScanBuffer,
  sortActivatedEntriesForInsertion,
  updateLoreRuntimeStateFromActivation,
  type ActivatedLoreEntry,
  type LorebookScanSource,
} from "../generation-core/lorebook-activation";
import {
  resolveMacros,
  type MacroContext,
  type ResolveMacroOptions,
} from "../generation-core/macros/macro-engine";
import { cleanTextArray } from "../shared/text";

export type GenerationProviderKind = "remote-runtime" | "external-provider";

export interface GenerationPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface GeneratedMessageDraft {
  characterId: string;
  body: string;
}

export interface GenerationResponse {
  schemaVersion: 1;
  requestId: string;
  providerKind: GenerationProviderKind;
  createdAt: string;
  messages: GeneratedMessageDraft[];
  warnings: string[];
}

export interface GenerationRequestBase {
  id: string;
  createdAt: string;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: GenerationPromptMessage[];
  parameters: GenerationParameters;
  /**
   * Non-fatal app-side context or activation warnings to surface after generation.
   */
  warnings: string[];
}

export interface GenerationAdapter<Request extends GenerationRequestBase> {
  providerKind: GenerationProviderKind;
  generate: (request: Request) => Promise<GenerationResponse>;
}

export interface GenerationRecordContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  /** Resolved lorebooks from every source bucket, deduped by first bucket precedence. */
  lorebooks: LorebookRecord[];
  /** Chat, persona, character, and global lorebooks before cross-bucket dedupe. */
  lorebookSources: LorebookSourceBuckets;
  /** Saved app-wide ordering preference for final lore insertion. */
  loreInsertionStrategy: LoreInsertionStrategy;
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  warnings: string[];
}

export interface ResolveGenerationRecordsInput {
  activePersonaId: string | null;
  characterIds: string[];
  lorebookIds: string[];
  providerConnectionId: string | null;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  /** App-wide lore source and insertion settings. */
  appSettings?: Pick<AppSettings, "globalLorebookIds" | "loreInsertionStrategy"> | null;
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  warningPrefix: string;
}

export function cleanGenerationText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function createGenerationWarning(prefix: string, kind: string, id: string) {
  return `${prefix} references a missing ${kind}: ${id}.`;
}

function resolveLorebookSourceBucket({
  ids,
  kind,
  lorebookById,
  warnings,
  warningPrefix,
}: {
  ids: string[];
  kind: LoreSourceKind;
  lorebookById: Map<string, LorebookRecord>;
  warnings: string[];
  warningPrefix: string;
}) {
  return cleanTextArray(ids).flatMap((lorebookId) => {
    const lorebook = lorebookById.get(lorebookId);
    if (lorebook) return [lorebook];
    warnings.push(createGenerationWarning(warningPrefix, `${kind} lorebook`, lorebookId));
    return [];
  });
}

export function namedGenerationBlock(title: string, lines: string[]) {
  const body = lines.filter((line) => line.trim()).join("\n");
  return body ? [`${title}\n${body}`] : [];
}

export type GenerationMacroContext = MacroContext;

/** Inputs Messenger and Roleplay use to build an engine-owned macro context. */
export interface GenerationMacroContextInput {
  activePersona?: PersonaRecord | null;
  companions?: CharacterRecord[];
  lastGenerationType?: string | null;
  /** Latest mode-owned input exposed to `{{input}}` after trimming. */
  lastInput?: string | null;
  now?: MacroContext["now"];
  providerConnection?: ProviderConnectionRecord | null;
  targetCompanion?: CharacterRecord | null;
  targetNameFallback?: string;
  threadId?: string | null;
  timeZone?: string | null;
  userNameFallback?: string;
}

function cleanMacroName(value: string | null | undefined, fallback: string) {
  return cleanGenerationText(value) || fallback;
}

/**
 * Creates the prompt macro context without storage, host, or provider calls.
 * Display names and input text are trimmed; empty names use caller fallbacks.
 */
export function createGenerationMacroContext({
  activePersona = null,
  companions = [],
  lastGenerationType = null,
  lastInput = null,
  now = null,
  providerConnection = null,
  targetCompanion = null,
  targetNameFallback = "the selected companion",
  threadId = null,
  timeZone = null,
  userNameFallback = "the user",
}: GenerationMacroContextInput): GenerationMacroContext {
  const user = cleanMacroName(activePersona?.displayName, userNameFallback);

  return {
    user,
    char: cleanMacroName(targetCompanion?.displayName, targetNameFallback),
    characters: companions
      .map((companion) => cleanGenerationText(companion.displayName))
      .filter(Boolean),
    characterFields: targetCompanion,
    personaFields: activePersona ? { displayName: user } : null,
    lastInput: cleanGenerationText(lastInput) || null,
    chatId: threadId,
    model: providerConnection?.model ?? null,
    lastGenerationType,
    now,
    timeZone,
  };
}

function createCharacterGenerationMacroContext(
  macroContext: GenerationMacroContext,
  character: CharacterRecord,
): GenerationMacroContext {
  return {
    ...macroContext,
    char: cleanMacroName(character.displayName, macroContext.char),
    characterFields: character,
  };
}

/**
 * Resolves generation prompt macros while preserving caller-owned surrounding
 * whitespace unless the caller passes different resolver options.
 */
export function resolveGenerationMacros(
  value: string,
  macroContext: GenerationMacroContext,
  options: ResolveMacroOptions = { trimResult: false },
) {
  return resolveMacros(value, macroContext, options);
}

function resolveOptionalGenerationMacros(
  value: string,
  macroContext: GenerationMacroContext | null | undefined,
  options?: ResolveMacroOptions,
) {
  return macroContext ? resolveGenerationMacros(value, macroContext, options) : value;
}

function resolveGenerationMacroField(
  value: string | null | undefined,
  macroContext: GenerationMacroContext | null | undefined,
  options?: ResolveMacroOptions,
) {
  return resolveOptionalGenerationMacros(value ?? "", macroContext, options);
}

function macroLabeledLines(
  macroContext: GenerationMacroContext | null | undefined,
  macroOptions: ResolveMacroOptions | undefined,
  rows: [label: string, value: string | null | undefined][],
) {
  return rows.flatMap(([label, value]) => {
    const resolved = resolveGenerationMacroField(value, macroContext, macroOptions).trim();
    return resolved ? [`${label}: ${resolved}`] : [];
  });
}

export interface LoreGenerationContextOptions {
  /** Active persona used by entries that opt into persona-description matching. */
  activePersona?: PersonaRecord | null;
  /** Selected companions used by entries that opt into companion match sources. */
  companions?: CharacterRecord[];
  includeSummary?: boolean;
  /** Optional prompt macro context for resolving lore activation and output text. */
  macroContext?: GenerationMacroContext | null;
  macroOptions?: ResolveMacroOptions;
  /** Transcript sources scanned according to each lorebook's scan depth. */
  scanSources?: LorebookScanSource[];
  contextTokens?: number | null;
  /** Already-loaded per-thread lore timer state for sticky and cooldown effects. */
  runtimeState?: LoreRuntimeState | null;
  /** Final ordering strategy after all source buckets have been activated. */
  insertionStrategy?: LoreInsertionStrategy;
}

/** Lorebooks grouped by the context source that selected them for generation. */
export type LorebookSourceBuckets = Record<LoreSourceKind, LorebookRecord[]>;

export interface ActivatedLoreGenerationResult {
  entries: ActivatedLoreEntry[];
  /** Updated lore timer state after activation and budget trimming. */
  runtimeState: LoreRuntimeState | null;
  warnings: string[];
}

/** Formatting state shared across system-prompt and at-depth lore placement. */
export interface LoreGenerationFormatOptions {
  includeSummary?: boolean;
  macroContext?: GenerationMacroContext | null;
  macroOptions?: ResolveMacroOptions;
  providerConnection?: ProviderConnectionRecord | null;
  summarizedLorebookIds?: Set<string>;
}

function approximatePromptTextTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function resolveLoreGenerationSummary(
  value: string,
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  return resolveOptionalGenerationMacros(value, options.macroContext, options.macroOptions).trim();
}

function resolveLoreGenerationEntryBody(
  entry: ActivatedLoreEntry,
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  return resolveOptionalGenerationMacros(
    entry.entry.body,
    options.macroContext,
    options.macroOptions,
  ).trim();
}

function approximateResolvedLoreEntryTokens(entry: ActivatedLoreEntry) {
  const body = entry.entry.body.trim();
  if (!body) return 0;

  return approximatePromptTextTokens(`${entry.lorebookTitle} / ${entry.entry.title}: ${body}`);
}

function resolveLorebookForGenerationActivation(
  lorebook: LorebookRecord,
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  const macroContext = options.macroContext;
  if (!macroContext) return lorebook;

  return {
    ...lorebook,
    summary: resolveLoreGenerationSummary(lorebook.summary, options),
    entries: lorebook.entries.map((entry) => ({
      ...entry,
      body: resolveOptionalGenerationMacros(entry.body, macroContext, options.macroOptions).trim(),
    })),
  };
}

function resolveMatchSourceCompanions(
  companions: CharacterRecord[],
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  const baseMacroContext = options.macroContext;
  if (!baseMacroContext) return companions;

  return companions.map((companion) => {
    const macroContext = createCharacterGenerationMacroContext(baseMacroContext, companion);
    const nickname = resolveGenerationMacroField(
      companion.nickname,
      macroContext,
      options.macroOptions,
    ).trim();

    return {
      ...companion,
      displayName: resolveGenerationMacroField(
        companion.displayName,
        macroContext,
        options.macroOptions,
      ).trim(),
      nickname: nickname || null,
      description: resolveGenerationMacroField(
        companion.description,
        macroContext,
        options.macroOptions,
      ).trim(),
      personality: resolveGenerationMacroField(
        companion.personality,
        macroContext,
        options.macroOptions,
      ).trim(),
      scenario: resolveGenerationMacroField(
        companion.scenario,
        macroContext,
        options.macroOptions,
      ).trim(),
      characterNote: resolveGenerationMacroField(
        companion.characterNote,
        macroContext,
        options.macroOptions,
      ).trim(),
    };
  });
}

function resolveMatchSourcePersona(
  persona: PersonaRecord | null,
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  const macroContext = options.macroContext;
  if (!persona || !macroContext) return persona;

  const nickname = resolveGenerationMacroField(
    persona.nickname,
    macroContext,
    options.macroOptions,
  ).trim();

  return {
    ...persona,
    displayName: resolveGenerationMacroField(
      persona.displayName,
      macroContext,
      options.macroOptions,
    ).trim(),
    nickname: nickname || null,
    description: resolveGenerationMacroField(
      persona.description,
      macroContext,
      options.macroOptions,
    ).trim(),
  };
}

function orderedLorebookSources(lorebooks: LorebookSourceBuckets) {
  const sources: { lorebook: LorebookRecord; sourceKind: LoreSourceKind; sourceOrder: number }[] =
    [];
  const sourceKinds: LoreSourceKind[] = ["chat", "persona", "character", "global"];
  const seenLorebookIds = new Set<string>();

  for (const sourceKind of sourceKinds) {
    for (const lorebook of lorebooks[sourceKind]) {
      if (seenLorebookIds.has(lorebook.id)) continue;
      seenLorebookIds.add(lorebook.id);
      sources.push({
        lorebook,
        sourceKind,
        sourceOrder: sources.length,
      });
    }
  }

  return sources;
}

export function characterGenerationContext(
  character: CharacterRecord,
  options: {
    includeExamples?: boolean;
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
    systemPromptLabel?: string;
  } = {},
) {
  const systemPromptLabel = options.systemPromptLabel ?? "System prompt";
  const includeExamples = options.includeExamples ?? true;
  const macroContext = options.macroContext
    ? createCharacterGenerationMacroContext(options.macroContext, character)
    : null;
  const displayName = resolveGenerationMacroField(
    character.displayName,
    macroContext,
    options.macroOptions,
  ).trim();
  const rows: [label: string, value: string | null | undefined][] = [
    ["Nickname", character.nickname],
    ["Description", character.description],
    ["Personality", character.personality],
    ["Scenario", character.scenario],
    [systemPromptLabel, character.systemPrompt],
  ];
  if (includeExamples) rows.push(["Example messages", character.exampleMessages]);
  rows.push(["Character note", character.characterNote]);

  return [`Name: ${displayName}`, ...macroLabeledLines(macroContext, options.macroOptions, rows)];
}

export function personaGenerationContext(
  persona: PersonaRecord,
  systemPromptLabel = "System prompt",
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  } = {},
) {
  const displayName = resolveGenerationMacroField(
    persona.displayName,
    options.macroContext,
    options.macroOptions,
  ).trim();

  return [
    `Name: ${displayName}`,
    ...macroLabeledLines(options.macroContext, options.macroOptions, [
      ["Nickname", persona.nickname],
      ["Description", persona.description],
      ["Personality", persona.personality],
      ["Scenario", persona.scenario],
      [systemPromptLabel, persona.systemPrompt],
      ["Persona note", persona.characterNote],
    ]),
  ];
}

export function activateLoreGenerationEntriesWithWarnings(
  lorebooks: LorebookSourceBuckets,
  options: LoreGenerationContextOptions = {},
): ActivatedLoreGenerationResult {
  const warnings: string[] = [];
  const scanSources = options.scanSources ?? [];
  const messageCount = scanSources.filter((source) => source.body?.trim()).length;
  let runtimeState = advanceLoreRuntimeStateForEvaluation(options.runtimeState, messageCount);
  const matchSources = buildMatchSources({
    activePersona: resolveMatchSourcePersona(options.activePersona ?? null, options),
    companions: resolveMatchSourceCompanions(options.companions ?? [], options),
  });
  const activatedEntries = orderedLorebookSources(lorebooks).flatMap(
    ({ lorebook, sourceKind, sourceOrder }) => {
      const activationLorebook = resolveLorebookForGenerationActivation(lorebook, options);
      const scanBuffer = buildScanBuffer(scanSources, activationLorebook.activation);
      const summary = activationLorebook.summary.trim();
      const reservedTokens =
        options.includeSummary && summary
          ? approximatePromptTextTokens(`${activationLorebook.title}: ${summary}`)
          : 0;
      const activation = activateLorebookEntriesWithWarnings(activationLorebook, scanBuffer, {
        matchSources,
        messageCount,
        runtimeState,
        sourceKind,
        sourceOrder,
      });
      warnings.push(...activation.warnings);
      const keptEntries = applyTokenBudget(activation.entries, {
        budgetTokens: activationLorebook.activation.budgetTokens,
        budgetPercent: activationLorebook.activation.budgetPercent,
        contextTokens: options.contextTokens,
        approxTokens: approximateResolvedLoreEntryTokens,
        reservedTokens,
      });
      runtimeState = updateLoreRuntimeStateFromActivation({
        activatedEntries: activation.entries,
        keptEntries,
        lorebook: activationLorebook,
        messageCount,
        runtimeState,
      });
      return keptEntries;
    },
  );
  return {
    entries: sortActivatedEntriesForInsertion(
      activatedEntries,
      options.insertionStrategy ?? "sorted-evenly",
    ),
    runtimeState,
    warnings: cleanTextArray(warnings),
  };
}

/** Formats activated entries, deduping optional lorebook summaries if needed. */
export function formatLoreGenerationEntries(
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const summarizedLorebookIds = options.summarizedLorebookIds ?? new Set<string>();
  return entries.flatMap((activatedEntry) => {
    const summary = resolveLoreGenerationSummary(activatedEntry.lorebookSummary, options);
    const summaryLine =
      options.includeSummary && summary && !summarizedLorebookIds.has(activatedEntry.lorebookId)
        ? `${activatedEntry.lorebookTitle}: ${summary}`
        : null;
    if (summaryLine) summarizedLorebookIds.add(activatedEntry.lorebookId);
    const body = resolveLoreGenerationEntryBody(activatedEntry, options);

    return [
      ...(summaryLine ? [summaryLine] : []),
      ...(body ? [`${activatedEntry.lorebookTitle} / ${activatedEntry.entry.title}: ${body}`] : []),
    ];
  });
}

function atDepthInsertionIndex(messageCount: number, depth: number | null) {
  const safeDepth =
    typeof depth === "number" && Number.isFinite(depth) ? Math.max(0, Math.trunc(depth)) : 0;
  return Math.max(0, Math.min(messageCount, messageCount - safeDepth));
}

function providerHoistsSystemMessages(
  providerConnection: ProviderConnectionRecord | null | undefined,
) {
  return providerConnection?.provider === "anthropic" || providerConnection?.provider === "google";
}

function atDepthLoreRole(
  entry: ActivatedLoreEntry,
  providerConnection: ProviderConnectionRecord | null | undefined,
) {
  const role = entry.entry.role ?? "system";
  return role === "system" && providerHoistsSystemMessages(providerConnection) ? "user" : role;
}

function groupedAtDepthLoreMessages(
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const groups = new Map<
    string,
    {
      depth: number | null;
      entries: ActivatedLoreEntry[];
      role: GenerationPromptMessage["role"];
    }
  >();

  for (const entry of entries) {
    const depth = entry.entry.depth ?? 0;
    const role = atDepthLoreRole(entry, options.providerConnection);
    const groupKey = `${depth}:${role}`;
    const group = groups.get(groupKey);
    if (group) {
      group.entries.push(entry);
    } else {
      groups.set(groupKey, { depth, entries: [entry], role });
    }
  }

  return [...groups.values()].map((group) => {
    const [content] = namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(group.entries, options),
    );
    return {
      depth: group.depth,
      message: {
        role: group.role,
        content: content ?? "",
      },
    };
  });
}

/**
 * Inserts lore into transcript messages by depth from the newest transcript
 * item. Depth 0 appends after the transcript; depth 1 inserts before the newest
 * transcript item. Caller-owned tail prompts should be appended after this.
 */
export function injectAtDepth(
  messages: GenerationPromptMessage[],
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const groupedLoreMessages = groupedAtDepthLoreMessages(entries, options)
    .filter((group) => group.message.content.trim())
    .map((group) => ({
      insertionIndex: atDepthInsertionIndex(messages.length, group.depth),
      message: group.message,
    }));

  const groupsByIndex = new Map<number, GenerationPromptMessage[]>();
  for (const group of groupedLoreMessages) {
    const existing = groupsByIndex.get(group.insertionIndex) ?? [];
    existing.push(group.message);
    groupsByIndex.set(group.insertionIndex, existing);
  }

  const result: GenerationPromptMessage[] = [];
  for (let index = 0; index <= messages.length; index += 1) {
    result.push(...(groupsByIndex.get(index) ?? []));
    if (index < messages.length) result.push(messages[index]);
  }

  return result;
}

export function exampleDialogueGenerationContext(
  companions: CharacterRecord[],
  options: {
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  } = {},
) {
  return companions.flatMap((companion) => {
    const macroContext = options.macroContext
      ? createCharacterGenerationMacroContext(options.macroContext, companion)
      : null;
    const displayName = resolveGenerationMacroField(
      companion.displayName,
      macroContext,
      options.macroOptions,
    ).trim();
    const exampleMessages = resolveGenerationMacroField(
      companion.exampleMessages,
      macroContext,
      options.macroOptions,
    ).trim();

    return exampleMessages ? [`${displayName}\n${exampleMessages}`] : [];
  });
}

export function createGenerationParameters(
  parameters: Partial<GenerationParameters> | undefined,
  providerConnection: ProviderConnectionRecord | null,
): GenerationParameters {
  return {
    temperature: parameters?.temperature ?? 0.8,
    maxTokens: parameters?.maxTokens ?? providerConnection?.maxOutput ?? 1024,
    topP: parameters?.topP ?? 0.95,
  };
}

export function resolveGenerationRecords({
  activePersonaId,
  appSettings = null,
  characterIds,
  characters,
  fallbackProviderConnectionId = null,
  lorebookIds,
  lorebooks,
  personas,
  providerConnectionId,
  providerConnections = [],
  warningPrefix,
}: ResolveGenerationRecordsInput): GenerationRecordContext {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const lorebookById = new Map(lorebooks.map((lorebook) => [lorebook.id, lorebook]));
  const connectionIds = new Set(providerConnections.map((connection) => connection.id));
  const warnings: string[] = [];

  const companions = cleanTextArray(characterIds).flatMap((characterId) => {
    const companion = characterById.get(characterId);
    if (companion) return [companion];
    warnings.push(createGenerationWarning(warningPrefix, "companion", characterId));
    return [];
  });

  const activePersona = activePersonaId ? (personaById.get(activePersonaId) ?? null) : null;
  if (activePersonaId && !activePersona) {
    warnings.push(createGenerationWarning(warningPrefix, "persona", activePersonaId));
  }

  const selectedLorebooks = resolveLorebookSourceBucket({
    ids: lorebookIds,
    kind: "chat",
    lorebookById,
    warnings,
    warningPrefix,
  });
  const lorebookSources: LorebookSourceBuckets = {
    chat: selectedLorebooks,
    persona: activePersona
      ? resolveLorebookSourceBucket({
          ids: activePersona.lorebookIds,
          kind: "persona",
          lorebookById,
          warnings,
          warningPrefix,
        })
      : [],
    character: resolveLorebookSourceBucket({
      ids: companions.flatMap((companion) => companion.lorebookIds),
      kind: "character",
      lorebookById,
      warnings,
      warningPrefix,
    }),
    global: resolveLorebookSourceBucket({
      ids: appSettings?.globalLorebookIds ?? [],
      kind: "global",
      lorebookById,
      warnings,
      warningPrefix,
    }),
  };

  let selectedProviderConnectionId = providerConnectionId;
  let providerConnection: ProviderConnectionRecord | null = selectedProviderConnectionId
    ? (providerConnections.find((connection) => connection.id === selectedProviderConnectionId) ??
      null)
    : null;
  if (selectedProviderConnectionId && !connectionIds.has(selectedProviderConnectionId)) {
    warnings.push(
      createGenerationWarning(warningPrefix, "provider connection", selectedProviderConnectionId),
    );
    selectedProviderConnectionId = null;
    providerConnection = null;
  }

  if (!selectedProviderConnectionId && fallbackProviderConnectionId) {
    providerConnection =
      providerConnections.find((connection) => connection.id === fallbackProviderConnectionId) ??
      null;
    selectedProviderConnectionId = providerConnection?.id ?? null;
  }

  return {
    activePersona,
    companions,
    lorebooks: orderedLorebookSources(lorebookSources).map((source) => source.lorebook),
    lorebookSources,
    loreInsertionStrategy: appSettings?.loreInsertionStrategy ?? "sorted-evenly",
    providerConnectionId: selectedProviderConnectionId,
    providerConnection,
    warnings,
  };
}
