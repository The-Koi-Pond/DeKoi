import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord } from "../contracts/types/lorebook";
import type { PersonaRecord } from "../contracts/types/persona";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import {
  activateLorebookEntriesWithWarnings,
  applyTokenBudget,
  buildMatchSources,
  buildScanBuffer,
  sortActivatedEntries,
  type ActivatedLoreEntry,
  type LorebookScanSource,
} from "../generation-core/lorebook-activation";

export type GenerationProviderKind =
  | "remote-runtime"
  | "external-provider";

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
  lorebooks: LorebookRecord[];
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
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  warningPrefix: string;
}

export function cleanGenerationText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function uniqueGenerationIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createGenerationWarning(prefix: string, kind: string, id: string) {
  return `${prefix} references a missing ${kind}: ${id}.`;
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
}

export interface ActivatedLoreGenerationResult {
  entries: ActivatedLoreEntry[];
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
  return [
    ...new Set(warnings.map((warning) => warning.trim()).filter(Boolean)),
  ];
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
    character.systemPrompt
      ? `${systemPromptLabel}: ${character.systemPrompt}`
      : "",
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
  lorebooks: LorebookRecord[],
  options: LoreGenerationContextOptions = {},
): ActivatedLoreGenerationResult {
  const warnings: string[] = [];
  const matchSources = buildMatchSources({
    activePersona: options.activePersona ?? null,
    companions: options.companions ?? [],
  });
  const activatedEntries = lorebooks.flatMap((lorebook, sourceOrder) => {
    const scanBuffer = buildScanBuffer(
      options.scanSources ?? [],
      lorebook.activation,
    );
    const summary = lorebook.summary.trim();
    const reservedTokens =
      options.includeSummary && summary
        ? approximatePromptTextTokens(`${lorebook.title}: ${summary}`)
        : 0;
    const activation = activateLorebookEntriesWithWarnings(lorebook, scanBuffer, {
      matchSources,
      sourceOrder,
    });
    warnings.push(...activation.warnings);
    return applyTokenBudget(
      activation.entries,
      {
        budgetTokens: lorebook.activation.budgetTokens,
        budgetPercent: lorebook.activation.budgetPercent,
        contextTokens: options.contextTokens,
        reservedTokens,
      },
    );
  });
  return {
    entries: sortActivatedEntries(activatedEntries),
    warnings: uniqueCleanWarnings(warnings),
  };
}

/** Activates selected lorebooks, applies their budgets, and sorts the result. */
export function activateLoreGenerationEntries(
  lorebooks: LorebookRecord[],
  options: LoreGenerationContextOptions = {},
) {
  return activateLoreGenerationEntriesWithWarnings(lorebooks, options).entries;
}

/** Formats activated entries, deduping optional lorebook summaries if needed. */
export function formatLoreGenerationEntries(
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const summarizedLorebookIds =
    options.summarizedLorebookIds ?? new Set<string>();
  return entries.flatMap((activatedEntry) => {
    const summary = activatedEntry.lorebookSummary.trim();
    const summaryLine =
      options.includeSummary &&
      summary &&
      !summarizedLorebookIds.has(activatedEntry.lorebookId)
        ? `${activatedEntry.lorebookTitle}: ${summary}`
        : null;
    if (summaryLine) summarizedLorebookIds.add(activatedEntry.lorebookId);

    return [
      ...(summaryLine ? [summaryLine] : []),
      `${activatedEntry.lorebookTitle} / ${activatedEntry.entry.title}: ${activatedEntry.entry.body.trim()}`,
    ];
  });
}

export function activatedLoreGenerationWarnings(entries: ActivatedLoreEntry[]) {
  return uniqueCleanWarnings(entries.flatMap((entry) => entry.warnings));
}

function atDepthInsertionIndex(messageCount: number, depth: number | null) {
  const safeDepth =
    typeof depth === "number" && Number.isFinite(depth)
      ? Math.max(0, Math.trunc(depth))
      : 0;
  return Math.max(0, Math.min(messageCount, messageCount - safeDepth));
}

function providerHoistsSystemMessages(
  providerConnection: ProviderConnectionRecord | null | undefined,
) {
  return (
    providerConnection?.provider === "anthropic" ||
    providerConnection?.provider === "google"
  );
}

function atDepthLoreRole(
  entry: ActivatedLoreEntry,
  providerConnection: ProviderConnectionRecord | null | undefined,
) {
  const role = entry.entry.role ?? "system";
  return role === "system" && providerHoistsSystemMessages(providerConnection)
    ? "user"
    : role;
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
  const characterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const lorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook]),
  );
  const connectionIds = new Set(
    providerConnections.map((connection) => connection.id),
  );
  const warnings: string[] = [];

  const companions = uniqueGenerationIds(characterIds).flatMap((characterId) => {
    const companion = characterById.get(characterId);
    if (companion) return [companion];
    warnings.push(createGenerationWarning(warningPrefix, "companion", characterId));
    return [];
  });

  const activePersona = activePersonaId
    ? personaById.get(activePersonaId) ?? null
    : null;
  if (activePersonaId && !activePersona) {
    warnings.push(createGenerationWarning(warningPrefix, "persona", activePersonaId));
  }

  const selectedLorebooks = uniqueGenerationIds(lorebookIds).flatMap(
    (lorebookId) => {
      const lorebook = lorebookById.get(lorebookId);
      if (lorebook) return [lorebook];
      warnings.push(createGenerationWarning(warningPrefix, "lorebook", lorebookId));
      return [];
    },
  );

  let selectedProviderConnectionId = providerConnectionId;
  let providerConnection: ProviderConnectionRecord | null =
    selectedProviderConnectionId
      ? (providerConnections.find(
          (connection) => connection.id === selectedProviderConnectionId,
        ) ?? null)
      : null;
  if (
    selectedProviderConnectionId &&
    !connectionIds.has(selectedProviderConnectionId)
  ) {
    warnings.push(
      createGenerationWarning(
        warningPrefix,
        "provider connection",
        selectedProviderConnectionId,
      ),
    );
    selectedProviderConnectionId = null;
    providerConnection = null;
  }

  if (!selectedProviderConnectionId && fallbackProviderConnectionId) {
    providerConnection =
      providerConnections.find(
        (connection) => connection.id === fallbackProviderConnectionId,
      ) ?? null;
    selectedProviderConnectionId = providerConnection?.id ?? null;
  }

  return {
    activePersona,
    companions,
    lorebooks: selectedLorebooks,
    providerConnectionId: selectedProviderConnectionId,
    providerConnection,
    warnings,
  };
}
