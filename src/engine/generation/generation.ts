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

function uniqueGenerationIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
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
  return uniqueGenerationIds(ids).flatMap((lorebookId) => {
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

export function replaceGenerationPromptMacros(
  prompt: string,
  targetName: string,
  userName: string,
) {
  return prompt
    .replaceAll("{{charName}}", targetName)
    .replaceAll("{{char}}", targetName)
    .replaceAll("{{userName}}", userName)
    .replaceAll("{{user}}", userName);
}

export interface LoreGenerationContextOptions {
  /** Active persona used by entries that opt into persona-description matching. */
  activePersona?: PersonaRecord | null;
  /** Selected companions used by entries that opt into companion match sources. */
  companions?: CharacterRecord[];
  includeSummary?: boolean;
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
  providerConnection?: ProviderConnectionRecord | null;
  summarizedLorebookIds?: Set<string>;
}

function approximatePromptTextTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function uniqueCleanWarnings(warnings: string[]) {
  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))];
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
  options: { includeExamples?: boolean; systemPromptLabel?: string } = {},
) {
  const systemPromptLabel = options.systemPromptLabel ?? "System prompt";
  const includeExamples = options.includeExamples ?? true;

  return [
    `Name: ${character.displayName}`,
    character.nickname ? `Nickname: ${character.nickname}` : "",
    character.description ? `Description: ${character.description}` : "",
    character.personality ? `Personality: ${character.personality}` : "",
    character.scenario ? `Scenario: ${character.scenario}` : "",
    character.systemPrompt ? `${systemPromptLabel}: ${character.systemPrompt}` : "",
    includeExamples && character.exampleMessages
      ? `Example messages: ${character.exampleMessages}`
      : "",
    character.characterNote ? `Character note: ${character.characterNote}` : "",
  ].filter(Boolean);
}

export function personaGenerationContext(
  persona: PersonaRecord,
  systemPromptLabel = "System prompt",
) {
  return [
    `Name: ${persona.displayName}`,
    persona.nickname ? `Nickname: ${persona.nickname}` : "",
    persona.description ? `Description: ${persona.description}` : "",
    persona.personality ? `Personality: ${persona.personality}` : "",
    persona.scenario ? `Scenario: ${persona.scenario}` : "",
    persona.systemPrompt ? `${systemPromptLabel}: ${persona.systemPrompt}` : "",
    persona.characterNote ? `Persona note: ${persona.characterNote}` : "",
  ].filter(Boolean);
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
    activePersona: options.activePersona ?? null,
    companions: options.companions ?? [],
  });
  const activatedEntries = orderedLorebookSources(lorebooks).flatMap(
    ({ lorebook, sourceKind, sourceOrder }) => {
      const scanBuffer = buildScanBuffer(scanSources, lorebook.activation);
      const summary = lorebook.summary.trim();
      const reservedTokens =
        options.includeSummary && summary
          ? approximatePromptTextTokens(`${lorebook.title}: ${summary}`)
          : 0;
      const activation = activateLorebookEntriesWithWarnings(lorebook, scanBuffer, {
        matchSources,
        messageCount,
        runtimeState,
        sourceKind,
        sourceOrder,
      });
      warnings.push(...activation.warnings);
      const keptEntries = applyTokenBudget(activation.entries, {
        budgetTokens: lorebook.activation.budgetTokens,
        budgetPercent: lorebook.activation.budgetPercent,
        contextTokens: options.contextTokens,
        reservedTokens,
      });
      runtimeState = updateLoreRuntimeStateFromActivation({
        activatedEntries: activation.entries,
        keptEntries,
        lorebook,
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
    warnings: uniqueCleanWarnings(warnings),
  };
}

/** Formats activated entries, deduping optional lorebook summaries if needed. */
export function formatLoreGenerationEntries(
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const summarizedLorebookIds = options.summarizedLorebookIds ?? new Set<string>();
  return entries.flatMap((activatedEntry) => {
    const summary = activatedEntry.lorebookSummary.trim();
    const summaryLine =
      options.includeSummary && summary && !summarizedLorebookIds.has(activatedEntry.lorebookId)
        ? `${activatedEntry.lorebookTitle}: ${summary}`
        : null;
    if (summaryLine) summarizedLorebookIds.add(activatedEntry.lorebookId);

    return [
      ...(summaryLine ? [summaryLine] : []),
      `${activatedEntry.lorebookTitle} / ${activatedEntry.entry.title}: ${activatedEntry.entry.body.trim()}`,
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

export function exampleDialogueGenerationContext(companions: CharacterRecord[]) {
  return companions.flatMap((companion) =>
    companion.exampleMessages.trim()
      ? [`${companion.displayName}\n${companion.exampleMessages.trim()}`]
      : [],
  );
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

  const companions = uniqueGenerationIds(characterIds).flatMap((characterId) => {
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
