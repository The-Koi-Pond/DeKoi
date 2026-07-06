import type { CharacterRecord } from "../contracts/types/character";
import type {
  LorebookActivationSettings,
  LoreEntryRecord,
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
  compareActivatedEntryBudgetPriority,
  sortActivatedEntriesForInsertion,
  updateLoreRuntimeStateFromActivation,
  type ActivatedLoreEntry,
  type LorebookScanSource,
} from "../generation-core/lorebook-activation";
import { activatedLoreEntryKey } from "../generation-core/lorebook-activation-types";
import {
  resolveMacros,
  type MacroContext,
  type MacroVariableMutation,
  type ResolveMacroOptions,
} from "../generation-core/macros/macro-engine";
import { mapMacroSpans } from "../generation-core/macros/macro-spans";
import {
  isRandomOptionMacroName,
  isRollMacroName,
} from "../generation-core/macros/macro-builtins/random-macros";
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

/**
 * Shared provider-facing request fields for mode-owned generation requests.
 * Messenger and Roleplay still own their prompt assembly and mode-specific
 * request fields.
 */
export interface GenerationRequestEnvelope<Thread> extends GenerationRequestBase {
  schemaVersion: 1;
  thread: Thread;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
}

/**
 * Creates the mode-neutral request envelope after the caller has selected the
 * mode thread, target companion, and final prompt messages.
 *
 * Warning order is preserved as context warnings followed by prompt warnings;
 * runtime workflows merge provider and dropped-draft warnings in their results.
 */
export function createGenerationRequestEnvelope<Thread>({
  context,
  id,
  now,
  parameters,
  promptMessages,
  promptWarnings = [],
  targetCompanion,
  thread,
}: {
  context: GenerationRecordContext;
  id: string;
  now: string;
  parameters?: Partial<GenerationParameters>;
  promptMessages: GenerationPromptMessage[];
  promptWarnings?: string[];
  targetCompanion: CharacterRecord | null;
  thread: Thread;
}): GenerationRequestEnvelope<Thread> {
  return {
    schemaVersion: 1,
    id,
    createdAt: now,
    thread,
    companions: context.companions,
    activePersona: context.activePersona,
    lorebooks: context.lorebooks,
    providerConnectionId: context.providerConnectionId,
    providerConnection: context.providerConnection,
    targetCharacterId: targetCompanion?.id ?? null,
    targetCharacterName: targetCompanion?.displayName ?? null,
    promptMessages,
    parameters: createGenerationParameters(parameters, context.providerConnection),
    warnings: [...context.warnings, ...promptWarnings],
  };
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
  /** Initial request-local variable state for prompt macro resolution. */
  variables?: Record<string, string>;
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
  variables = {},
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
    variables: { ...variables },
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

function resolveGenerationMacrosDiscardingVariables(
  value: string | null | undefined,
  macroContext: GenerationMacroContext,
  options: ResolveMacroOptions = { trimResult: false },
) {
  return resolveMacros(value ?? "", createScratchGenerationMacroContext(macroContext), options);
}

function activationMacroOptions(options: ResolveMacroOptions | undefined): ResolveMacroOptions {
  return { ...(options ?? {}), randomSelection: "first" };
}

function budgetMacroOptions(options: ResolveMacroOptions | undefined): ResolveMacroOptions {
  return { ...(options ?? {}), randomSelection: "longest" };
}

function resolveGenerationMacrosForActivation(
  value: string | null | undefined,
  macroContext: GenerationMacroContext,
  options: ResolveMacroOptions | undefined,
) {
  return resolveGenerationMacrosDiscardingVariables(
    value,
    macroContext,
    activationMacroOptions(options),
  );
}

function snapshotGenerationVariables(macroContext: GenerationMacroContext) {
  return { ...macroContext.variables };
}

function createScratchGenerationMacroContext(macroContext: GenerationMacroContext) {
  const scratchContext = {
    ...macroContext,
    variables: snapshotGenerationVariables(macroContext),
  };
  delete scratchContext.variableMutations;
  return scratchContext;
}

function readGenerationVariableNumber(value: string | undefined) {
  const numberValue = Number(value ?? "0");
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function applyGenerationVariableMutations(
  variables: Record<string, string>,
  mutations: MacroVariableMutation[],
) {
  for (const mutation of mutations) {
    if (mutation.kind === "set") {
      variables[mutation.name] = mutation.value;
    } else {
      variables[mutation.name] = String(
        readGenerationVariableNumber(variables[mutation.name]) + mutation.delta,
      );
    }
  }
}

function resolveGenerationMacroPreview(
  value: string | null | undefined,
  macroContext: GenerationMacroContext,
  options: ResolveMacroOptions = { trimResult: false },
  extraMutations: MacroVariableMutation[] = [],
): ResolvedGenerationMacroPreview {
  const source = value ?? "";
  const variableMutations: MacroVariableMutation[] = [];
  const scratchContext = createScratchGenerationMacroContext(macroContext);
  applyGenerationVariableMutations(scratchContext.variables, extraMutations);
  scratchContext.variableMutations = variableMutations;
  const content = resolveMacros(source, scratchContext, options);

  return {
    content,
    variableMutations,
  };
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
  /** Updated lore timer state, or the pre-formatting state until macro lore is finalized. */
  runtimeState: LoreRuntimeState | null;
  warnings: string[];
}

interface ResolvedGenerationMacroPreview {
  content: string;
  variableMutations: MacroVariableMutation[];
}

interface PendingGenerationMacroCommit {
  consumedContexts: WeakSet<GenerationMacroContext>;
  macroOptions?: ResolveMacroOptions;
  source: string;
}

interface PendingLoreGenerationBudget {
  budget: number;
  entries: ActivatedLoreEntry[];
  contexts: WeakMap<GenerationMacroContext, LoreGenerationBudgetContextState>;
}

interface LoreGenerationBudgetContextState {
  droppedEntryKeys: Set<string>;
  previewTokensByEntryKey: Map<string, number>;
  previewVariablesKey: string;
  settledBodyTokensByEntryKey: Map<string, number>;
  summaryReserved: boolean;
  usedTokens: number;
}

interface LoreGenerationFormattingState {
  keptEntryKeys: Set<string>;
  lorebooks: {
    activatedEntries: ActivatedLoreEntry[];
    lorebook: LorebookRecord;
  }[];
  messageCount: number;
  runtimeState: LoreRuntimeState | null;
  settledEntryKeys: Set<string>;
}

interface LorebookMacroPreviews {
  entriesById: Map<string, PendingGenerationMacroCommit>;
  summary: PendingGenerationMacroCommit | null;
}

const LORE_GENERATION_MACRO_COMMIT = Symbol("loreGenerationMacroCommit");
const LORE_GENERATION_FORMATTING_STATE = Symbol("loreGenerationFormattingState");
const LORE_BUDGET_VARIABLE_READ_PATTERN = /{{\s*(?:getvar::|#if(?:\s|}))/i;
const LORE_BUDGET_BARE_MACRO_PATTERN = /{{\s*([A-Za-z0-9_-]+)\s*}}/g;
const STABLE_LORE_BUDGET_BARE_MACROS = new Set([
  "banned",
  "char",
  "characters",
  "charName",
  "chatId",
  "date",
  "idle_duration",
  "input",
  "isotime",
  "lastGenerationType",
  "lowercase",
  "model",
  "newline",
  "noop",
  "persona",
  "random",
  "time",
  "timezone",
  "trim",
  "trimEnd",
  "trimStart",
  "uppercase",
  "user",
  "userName",
  "weekday",
]);

interface LoreGenerationMacroCommit {
  budget: PendingLoreGenerationBudget | null;
  entry: PendingGenerationMacroCommit | null;
  formattingState: LoreGenerationFormattingState | null;
  summary: PendingGenerationMacroCommit | null;
}

type ActivatedLoreEntryWithMacroCommit = ActivatedLoreEntry & {
  [LORE_GENERATION_MACRO_COMMIT]?: LoreGenerationMacroCommit;
};

type ActivatedLoreGenerationResultWithFormattingState = ActivatedLoreGenerationResult & {
  [LORE_GENERATION_FORMATTING_STATE]?: LoreGenerationFormattingState | null;
};

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

function resolveLoreGenerationTokenBudget(
  activation: Pick<LorebookActivationSettings, "budgetPercent" | "budgetTokens">,
  contextTokens: number | null | undefined,
) {
  if (
    typeof activation.budgetTokens === "number" &&
    Number.isFinite(activation.budgetTokens) &&
    activation.budgetTokens >= 0
  ) {
    return Math.trunc(activation.budgetTokens);
  }

  if (
    typeof activation.budgetPercent === "number" &&
    Number.isFinite(activation.budgetPercent) &&
    activation.budgetPercent >= 0 &&
    typeof contextTokens === "number" &&
    Number.isFinite(contextTokens) &&
    contextTokens >= 0
  ) {
    return Math.trunc((contextTokens * Math.min(100, activation.budgetPercent)) / 100);
  }

  return null;
}

function createPendingLoreGenerationBudget(
  activation: LorebookActivationSettings,
  contextTokens: number | null | undefined,
  entries: ActivatedLoreEntry[],
): PendingLoreGenerationBudget | null {
  const budget = resolveLoreGenerationTokenBudget(activation, contextTokens);
  return budget === null ? null : { budget, entries, contexts: new WeakMap() };
}

function createLoreGenerationFormattingState(
  runtimeState: LoreRuntimeState | null,
  messageCount: number,
): LoreGenerationFormattingState {
  return {
    keptEntryKeys: new Set(),
    lorebooks: [],
    messageCount,
    runtimeState,
    settledEntryKeys: new Set(),
  };
}

function loreGenerationBudgetVariablesKey(macroContext: GenerationMacroContext) {
  return JSON.stringify(
    Object.entries(macroContext.variables).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function refreshLoreGenerationBudgetContextState(
  state: LoreGenerationBudgetContextState,
  macroContext: GenerationMacroContext,
) {
  const variablesKey = loreGenerationBudgetVariablesKey(macroContext);
  if (state.previewVariablesKey === variablesKey) return;

  for (const key of [...state.previewTokensByEntryKey.keys()]) {
    if (!state.settledBodyTokensByEntryKey.has(key)) {
      state.previewTokensByEntryKey.delete(key);
    }
  }
  state.previewVariablesKey = variablesKey;
}

function loreGenerationBudgetContextState(
  budget: PendingLoreGenerationBudget,
  macroContext: GenerationMacroContext,
) {
  const existingState = budget.contexts.get(macroContext);
  if (existingState) {
    refreshLoreGenerationBudgetContextState(existingState, macroContext);
    return existingState;
  }

  const state: LoreGenerationBudgetContextState = {
    droppedEntryKeys: new Set(),
    previewTokensByEntryKey: new Map(),
    previewVariablesKey: loreGenerationBudgetVariablesKey(macroContext),
    settledBodyTokensByEntryKey: new Map(),
    summaryReserved: false,
    usedTokens: 0,
  };
  budget.contexts.set(macroContext, state);
  return state;
}

function hasHigherLoreGenerationBudgetPriority(
  candidate: ActivatedLoreEntry,
  activatedEntry: ActivatedLoreEntry,
) {
  return compareActivatedEntryBudgetPriority(candidate, activatedEntry) < 0;
}

function loreGenerationBudgetSource(entry: ActivatedLoreEntry) {
  return loreGenerationMacroCommit(entry)?.entry?.source ?? entry.entry.body;
}

function loreEntryHasSourceBody(entry: LoreEntryRecord, previews: LorebookMacroPreviews) {
  return (previews.entriesById.get(entry.id)?.source ?? entry.body).trim().length > 0;
}

function loreRuntimeEntryHasSourceBody(activatedEntries: ActivatedLoreEntry[]) {
  const sourceBodyByEntryId = new Map(
    activatedEntries.map((entry) => [entry.entry.id, loreGenerationBudgetSource(entry)]),
  );

  return (entry: LoreEntryRecord) =>
    (sourceBodyByEntryId.get(entry.id) ?? entry.body).trim().length > 0;
}

function stripRandomOrRollMacroSpans(input: string) {
  return mapMacroSpans(input, ({ body }) => `{{${body}}}`, {
    replaceRawMacro: (span) => (isRandomOrRollMacroName(span.body.trim()) ? "" : null),
  });
}

function isRandomOrRollMacroName(name: string) {
  return name === "random" || isRandomOptionMacroName(name) || isRollMacroName(name);
}

function loreGenerationRecursionBody(
  entry: ActivatedLoreEntry,
  previews: LorebookMacroPreviews,
  options: {
    macroContext: GenerationMacroContext;
    macroOptions?: ResolveMacroOptions;
  },
) {
  const source = previews.entriesById.get(entry.entry.id)?.source ?? entry.entry.body;
  return resolveGenerationMacrosForActivation(
    stripRandomOrRollMacroSpans(source),
    options.macroContext,
    options.macroOptions,
  );
}

function hasMutableBareLoreBudgetMacro(source: string) {
  for (const match of source.matchAll(LORE_BUDGET_BARE_MACRO_PATTERN)) {
    const name = match[1] ?? "";
    if (!STABLE_LORE_BUDGET_BARE_MACROS.has(name)) return true;
  }

  return false;
}

function hasMutableLoreGenerationBudgetPreview(entry: ActivatedLoreEntry) {
  const source = loreGenerationBudgetSource(entry);
  return LORE_BUDGET_VARIABLE_READ_PATTERN.test(source) || hasMutableBareLoreBudgetMacro(source);
}

function conservativeLoreGenerationBudgetPreviewTokens(
  budget: PendingLoreGenerationBudget,
  activatedEntry: ActivatedLoreEntry,
  candidate: ActivatedLoreEntry,
  reservedTokens: number,
) {
  if (!hasHigherLoreGenerationBudgetPriority(candidate, activatedEntry)) return null;
  const candidateKey = activatedLoreEntryKey(candidate);
  const formattingState = loreGenerationMacroCommit(candidate)?.formattingState;
  if (formattingState?.settledEntryKeys.has(candidateKey)) return null;
  if (!hasMutableLoreGenerationBudgetPreview(candidate)) return null;

  return Math.max(0, budget.budget - reservedTokens);
}

function canReserveLoreGenerationBudget(
  budget: PendingLoreGenerationBudget | null,
  macroContext: GenerationMacroContext,
  activatedEntry: ActivatedLoreEntry,
  summaryTokens: number,
  bodyTokens: number,
  resolveCandidateBodyTokens: (entry: ActivatedLoreEntry) => number,
) {
  if (!budget) return true;

  const state = loreGenerationBudgetContextState(budget, macroContext);
  const entryKey = activatedLoreEntryKey(activatedEntry);
  if (state.droppedEntryKeys.has(entryKey)) return false;
  const reservedTokens = state.summaryReserved ? 0 : summaryTokens;
  state.previewTokensByEntryKey.set(
    entryKey,
    Math.max(state.previewTokensByEntryKey.get(entryKey) ?? 0, bodyTokens),
  );

  const priorityEntries = applyTokenBudget(
    budget.entries.filter((entry) => !state.droppedEntryKeys.has(activatedLoreEntryKey(entry))),
    {
      budgetTokens: budget.budget,
      approxTokens: (entry) => {
        const key = activatedLoreEntryKey(entry);
        const settledTokens = state.settledBodyTokensByEntryKey.get(key);
        if (typeof settledTokens === "number") return settledTokens;
        const conservativeTokens = conservativeLoreGenerationBudgetPreviewTokens(
          budget,
          activatedEntry,
          entry,
          reservedTokens,
        );
        if (typeof conservativeTokens === "number") return conservativeTokens;
        const previewTokens = state.previewTokensByEntryKey.get(key);
        if (typeof previewTokens === "number") return previewTokens;
        const resolvedTokens = resolveCandidateBodyTokens(entry);
        state.previewTokensByEntryKey.set(key, resolvedTokens);
        return resolvedTokens;
      },
      reservedTokens,
    },
  );
  if (!priorityEntries.some((entry) => activatedLoreEntryKey(entry) === entryKey)) return false;

  const nextSummaryTokens = reservedTokens;
  if (nextSummaryTokens > 0 && state.usedTokens + nextSummaryTokens > budget.budget) return false;

  return state.usedTokens + nextSummaryTokens + bodyTokens <= budget.budget;
}

function dropLoreGenerationBudgetEntry(
  budget: PendingLoreGenerationBudget | null,
  macroContext: GenerationMacroContext,
  activatedEntry: ActivatedLoreEntry,
) {
  if (!budget) return;
  loreGenerationBudgetContextState(budget, macroContext).droppedEntryKeys.add(
    activatedLoreEntryKey(activatedEntry),
  );
}

function reserveLoreGenerationBudget(
  budget: PendingLoreGenerationBudget | null,
  macroContext: GenerationMacroContext,
  activatedEntry: ActivatedLoreEntry,
  summaryTokens: number,
  bodyTokens: number,
) {
  if (!budget) return;

  const state = loreGenerationBudgetContextState(budget, macroContext);
  if (!state.summaryReserved && summaryTokens > 0) {
    state.summaryReserved = true;
    state.usedTokens += summaryTokens;
  }
  state.settledBodyTokensByEntryKey.set(activatedLoreEntryKey(activatedEntry), bodyTokens);
  state.usedTokens += bodyTokens;
}

function settleLoreGenerationFormattingEntry(activatedEntry: ActivatedLoreEntry) {
  loreGenerationMacroCommit(activatedEntry)?.formattingState?.settledEntryKeys.add(
    activatedLoreEntryKey(activatedEntry),
  );
}

function attachLoreGenerationMacroCommit(
  activatedEntry: ActivatedLoreEntry,
  macroCommit: LoreGenerationMacroCommit,
) {
  const entryWithMacroCommit: ActivatedLoreEntryWithMacroCommit = {
    ...activatedEntry,
    entry: {
      ...activatedEntry.entry,
    },
  };

  Object.defineProperty(entryWithMacroCommit, LORE_GENERATION_MACRO_COMMIT, {
    enumerable: false,
    value: macroCommit,
  });

  return entryWithMacroCommit;
}

function loreGenerationMacroCommit(entry: ActivatedLoreEntry) {
  return (entry as ActivatedLoreEntryWithMacroCommit)[LORE_GENERATION_MACRO_COMMIT] ?? null;
}

function attachLoreGenerationFormattingState(
  result: ActivatedLoreGenerationResult,
  formattingState: LoreGenerationFormattingState | null,
) {
  if (!formattingState) return result;

  Object.defineProperty(result, LORE_GENERATION_FORMATTING_STATE, {
    enumerable: false,
    value: formattingState,
  });
  return result;
}

function loreGenerationFormattingState(result: ActivatedLoreGenerationResult) {
  return (
    (result as ActivatedLoreGenerationResultWithFormattingState)[
      LORE_GENERATION_FORMATTING_STATE
    ] ?? null
  );
}

function createPendingGenerationMacroCommit(
  value: string | null | undefined,
  macroOptions?: ResolveMacroOptions,
): PendingGenerationMacroCommit {
  return {
    consumedContexts: new WeakSet(),
    macroOptions,
    source: value ?? "",
  };
}

function resolvePendingGenerationMacroCommit(
  commit: PendingGenerationMacroCommit,
  macroContext: GenerationMacroContext,
  options: ResolveMacroOptions | undefined,
  extraMutations: MacroVariableMutation[] = [],
) {
  if (commit.consumedContexts.has(macroContext)) {
    throw new Error("Cannot format lore macro text more than once with the same macro context.");
  }

  return resolveGenerationMacroPreview(
    commit.source,
    macroContext,
    options ?? commit.macroOptions,
    extraMutations,
  );
}

function consumeLoreGenerationMacroPreview(
  commit: PendingGenerationMacroCommit,
  preview: ResolvedGenerationMacroPreview | null | undefined,
  macroContext: GenerationMacroContext | null | undefined,
) {
  if (!preview || !macroContext) return;
  if (commit.consumedContexts.has(macroContext)) {
    throw new Error("Cannot format lore macro text more than once with the same macro context.");
  }

  applyGenerationVariableMutations(macroContext.variables, preview.variableMutations);
  commit.consumedContexts.add(macroContext);
}

function discardPendingGenerationMacroCommit(
  commit: PendingGenerationMacroCommit | null | undefined,
  macroContext: GenerationMacroContext,
) {
  if (!commit) return;
  if (commit.consumedContexts.has(macroContext)) {
    throw new Error("Cannot format lore macro text more than once with the same macro context.");
  }

  commit.consumedContexts.add(macroContext);
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
  const previews: LorebookMacroPreviews = {
    entriesById: new Map(),
    summary: null,
  };
  const macroContext = options.macroContext;
  if (!macroContext) return { lorebook, previews };

  const summary = createPendingGenerationMacroCommit(lorebook.summary, options.macroOptions);
  previews.summary = summary;

  return {
    lorebook: {
      ...lorebook,
      summary: resolveGenerationMacrosForActivation(
        summary.source,
        macroContext,
        options.macroOptions,
      ).trim(),
      entries: lorebook.entries.map((entry) => {
        const body = createPendingGenerationMacroCommit(entry.body, options.macroOptions);
        previews.entriesById.set(entry.id, body);
        return {
          ...entry,
          body: resolveGenerationMacrosForActivation(
            body.source,
            macroContext,
            options.macroOptions,
          ).trim(),
        };
      }),
    },
    previews,
  };
}

function attachKeptLoreGenerationMacroCommits(
  keptEntries: ActivatedLoreEntry[],
  previews: LorebookMacroPreviews,
  options: {
    budget: PendingLoreGenerationBudget | null;
    formattingState: LoreGenerationFormattingState | null;
    includeSummary?: boolean;
    macroContext?: GenerationMacroContext | null;
    macroOptions?: ResolveMacroOptions;
  },
) {
  const macroContext = options.macroContext;
  if (!macroContext) return keptEntries;

  const summaryPreview = keptEntries.length > 0 ? previews.summary : null;

  const committedEntries = keptEntries.map((activatedEntry) =>
    attachLoreGenerationMacroCommit(activatedEntry, {
      budget: options.budget,
      entry: previews.entriesById.get(activatedEntry.entry.id) ?? null,
      formattingState: options.formattingState,
      summary: summaryPreview,
    }),
  );
  if (options.budget) {
    options.budget.entries = committedEntries;
  }
  return committedEntries;
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
    const nickname = resolveGenerationMacrosForActivation(
      companion.nickname,
      macroContext,
      options.macroOptions,
    ).trim();

    return {
      ...companion,
      displayName: resolveGenerationMacrosForActivation(
        companion.displayName,
        macroContext,
        options.macroOptions,
      ).trim(),
      nickname: nickname || null,
      description: resolveGenerationMacrosForActivation(
        companion.description,
        macroContext,
        options.macroOptions,
      ).trim(),
      personality: resolveGenerationMacrosForActivation(
        companion.personality,
        macroContext,
        options.macroOptions,
      ).trim(),
      scenario: resolveGenerationMacrosForActivation(
        companion.scenario,
        macroContext,
        options.macroOptions,
      ).trim(),
      characterNote: resolveGenerationMacrosForActivation(
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

  const nickname = resolveGenerationMacrosForActivation(
    persona.nickname,
    macroContext,
    options.macroOptions,
  ).trim();

  return {
    ...persona,
    displayName: resolveGenerationMacrosForActivation(
      persona.displayName,
      macroContext,
      options.macroOptions,
    ).trim(),
    nickname: nickname || null,
    description: resolveGenerationMacrosForActivation(
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
  const macroContext = options.macroContext ?? null;
  const formattingState = macroContext
    ? createLoreGenerationFormattingState(runtimeState, messageCount)
    : null;
  const matchSources = buildMatchSources({
    activePersona: resolveMatchSourcePersona(options.activePersona ?? null, options),
    companions: resolveMatchSourceCompanions(options.companions ?? [], options),
  });
  const activatedEntries = orderedLorebookSources(lorebooks).flatMap(
    ({ lorebook, sourceKind, sourceOrder }) => {
      const { lorebook: activationLorebook, previews } = resolveLorebookForGenerationActivation(
        lorebook,
        options,
      );
      const scanBuffer = buildScanBuffer(scanSources, activationLorebook.activation);
      const summary = activationLorebook.summary.trim();
      const reservedTokens =
        options.includeSummary && summary
          ? approximatePromptTextTokens(`${activationLorebook.title}: ${summary}`)
          : 0;
      const activation = activateLorebookEntriesWithWarnings(activationLorebook, scanBuffer, {
        entryHasBody: formattingState
          ? (entry: LoreEntryRecord) => loreEntryHasSourceBody(entry, previews)
          : undefined,
        matchSources,
        messageCount,
        runtimeState,
        recursionBody:
          formattingState && macroContext
            ? (entry) =>
                loreGenerationRecursionBody(entry, previews, {
                  macroContext,
                  macroOptions: options.macroOptions,
                })
            : undefined,
        sourceKind,
        sourceOrder,
      });
      warnings.push(...activation.warnings);
      const budget = formattingState
        ? createPendingLoreGenerationBudget(
            activationLorebook.activation,
            options.contextTokens,
            activation.entries,
          )
        : null;
      const keptEntries = formattingState
        ? activation.entries
        : applyTokenBudget(activation.entries, {
            budgetTokens: activationLorebook.activation.budgetTokens,
            budgetPercent: activationLorebook.activation.budgetPercent,
            contextTokens: options.contextTokens,
            approxTokens: approximateResolvedLoreEntryTokens,
            reservedTokens,
          });
      const committedEntries = attachKeptLoreGenerationMacroCommits(keptEntries, previews, {
        ...options,
        budget,
        formattingState,
      });
      if (formattingState) {
        formattingState.lorebooks.push({
          activatedEntries: activation.entries,
          lorebook: activationLorebook,
        });
      } else {
        runtimeState = updateLoreRuntimeStateFromActivation({
          activatedEntries: activation.entries,
          keptEntries: committedEntries,
          lorebook: activationLorebook,
          messageCount,
          runtimeState,
        });
      }
      return committedEntries;
    },
  );
  return attachLoreGenerationFormattingState(
    {
      entries: sortActivatedEntriesForInsertion(
        activatedEntries,
        options.insertionStrategy ?? "sorted-evenly",
      ),
      runtimeState,
      warnings: cleanTextArray(warnings),
    },
    formattingState,
  );
}

function loreGenerationSummaryLine(activatedEntry: ActivatedLoreEntry, summary: string) {
  return summary ? `${activatedEntry.lorebookTitle}: ${summary}` : null;
}

function loreGenerationEntryBodyLine(activatedEntry: ActivatedLoreEntry, body: string) {
  return body ? `${activatedEntry.lorebookTitle} / ${activatedEntry.entry.title}: ${body}` : null;
}

function resolveLoreGenerationBudgetEntryBodyTokens(
  activatedEntry: ActivatedLoreEntry,
  macroContext: GenerationMacroContext,
  options: LoreGenerationFormatOptions,
  summaryMutations: MacroVariableMutation[],
) {
  const entryCommit = loreGenerationMacroCommit(activatedEntry)?.entry ?? null;
  const entryPreview = entryCommit
    ? resolvePendingGenerationMacroCommit(
        entryCommit,
        macroContext,
        budgetMacroOptions(options.macroOptions),
        summaryMutations,
      )
    : null;
  const body = (entryPreview?.content ?? activatedEntry.entry.body).trim();
  const bodyLine = loreGenerationEntryBodyLine(activatedEntry, body);

  return bodyLine ? approximatePromptTextTokens(bodyLine) : 0;
}

function formatLoreGenerationEntryWithMacroContext(
  activatedEntry: ActivatedLoreEntry,
  options: LoreGenerationFormatOptions,
  summarizedLorebookIds: Set<string>,
) {
  const macroContext = options.macroContext;
  const macroCommit = loreGenerationMacroCommit(activatedEntry);
  if (!macroContext || !macroCommit) return [];

  const shouldIncludeSummary =
    options.includeSummary && !summarizedLorebookIds.has(activatedEntry.lorebookId);
  const summaryCommit = shouldIncludeSummary ? macroCommit.summary : null;
  const entryCommit = macroCommit.entry;
  let resolveBudgetCandidateBodyTokens: (entry: ActivatedLoreEntry) => number = () => 0;
  if (macroCommit.budget) {
    const budgetSummaryPreview = summaryCommit
      ? resolvePendingGenerationMacroCommit(
          summaryCommit,
          macroContext,
          budgetMacroOptions(options.macroOptions),
        )
      : null;
    const budgetSummary = shouldIncludeSummary
      ? (budgetSummaryPreview?.content ?? activatedEntry.lorebookSummary).trim()
      : "";
    const budgetSummaryLine = shouldIncludeSummary
      ? loreGenerationSummaryLine(activatedEntry, budgetSummary)
      : null;
    const budgetSummaryMutations =
      budgetSummaryLine && budgetSummaryPreview ? budgetSummaryPreview.variableMutations : [];
    const budgetSummaryTokens = budgetSummaryLine
      ? approximatePromptTextTokens(budgetSummaryLine)
      : 0;
    resolveBudgetCandidateBodyTokens = (entry) => {
      const state = loreGenerationBudgetContextState(macroCommit.budget!, macroContext);
      const entryKey = activatedLoreEntryKey(entry);
      const previewTokens = state.previewTokensByEntryKey.get(entryKey);
      if (typeof previewTokens === "number") return previewTokens;
      const bodyTokens = resolveLoreGenerationBudgetEntryBodyTokens(
        entry,
        macroContext,
        options,
        budgetSummaryMutations,
      );
      state.previewTokensByEntryKey.set(entryKey, bodyTokens);
      return bodyTokens;
    };
    const budgetBodyTokens = resolveBudgetCandidateBodyTokens(activatedEntry);
    if (
      !canReserveLoreGenerationBudget(
        macroCommit.budget,
        macroContext,
        activatedEntry,
        budgetSummaryTokens,
        budgetBodyTokens,
        resolveBudgetCandidateBodyTokens,
      )
    ) {
      dropLoreGenerationBudgetEntry(macroCommit.budget, macroContext, activatedEntry);
      settleLoreGenerationFormattingEntry(activatedEntry);
      return [];
    }
  }

  const summaryPreview = summaryCommit
    ? resolvePendingGenerationMacroCommit(summaryCommit, macroContext, options.macroOptions)
    : null;
  const summary = shouldIncludeSummary
    ? (summaryPreview?.content ?? activatedEntry.lorebookSummary).trim()
    : "";
  const summaryLine = shouldIncludeSummary
    ? loreGenerationSummaryLine(activatedEntry, summary)
    : null;
  const summaryMutations = summaryLine && summaryPreview ? summaryPreview.variableMutations : [];
  const entryPreview = entryCommit
    ? resolvePendingGenerationMacroCommit(
        entryCommit,
        macroContext,
        options.macroOptions,
        summaryMutations,
      )
    : null;
  const body = (entryPreview?.content ?? activatedEntry.entry.body).trim();
  const bodyLine = loreGenerationEntryBodyLine(activatedEntry, body);
  if (!bodyLine) {
    dropLoreGenerationBudgetEntry(macroCommit.budget, macroContext, activatedEntry);
    discardPendingGenerationMacroCommit(entryCommit, macroContext);
    settleLoreGenerationFormattingEntry(activatedEntry);
    return [];
  }

  const summaryTokens = summaryLine ? approximatePromptTextTokens(summaryLine) : 0;
  const bodyTokens = approximatePromptTextTokens(bodyLine);
  if (
    !canReserveLoreGenerationBudget(
      macroCommit.budget,
      macroContext,
      activatedEntry,
      summaryTokens,
      bodyTokens,
      resolveBudgetCandidateBodyTokens,
    )
  ) {
    dropLoreGenerationBudgetEntry(macroCommit.budget, macroContext, activatedEntry);
    settleLoreGenerationFormattingEntry(activatedEntry);
    return [];
  }

  if (summaryLine && summaryCommit && summaryPreview) {
    consumeLoreGenerationMacroPreview(summaryCommit, summaryPreview, macroContext);
    summarizedLorebookIds.add(activatedEntry.lorebookId);
  } else if (summaryLine) {
    summarizedLorebookIds.add(activatedEntry.lorebookId);
  }
  if (entryCommit && entryPreview) {
    consumeLoreGenerationMacroPreview(entryCommit, entryPreview, macroContext);
  }
  reserveLoreGenerationBudget(
    macroCommit.budget,
    macroContext,
    activatedEntry,
    summaryTokens,
    bodyTokens,
  );
  macroCommit.formattingState?.keptEntryKeys.add(activatedLoreEntryKey(activatedEntry));
  settleLoreGenerationFormattingEntry(activatedEntry);

  return [...(summaryLine ? [summaryLine] : []), bodyLine];
}

/** Formats activated entries, deduping optional lorebook summaries if needed. */
export function formatLoreGenerationEntries(
  entries: ActivatedLoreEntry[],
  options: LoreGenerationFormatOptions = {},
) {
  const hasMacroCommittedEntry = entries.some((entry) => loreGenerationMacroCommit(entry));
  if (!options.macroContext && hasMacroCommittedEntry) {
    throw new Error("Cannot format macro-activated lore entries without a macro context.");
  }

  if (options.macroContext) {
    const hasUnresolvedEntry = entries.some((entry) => !loreGenerationMacroCommit(entry));
    if (hasUnresolvedEntry) {
      throw new Error("Cannot format unresolved lore entries with a macro context.");
    }
  }

  const summarizedLorebookIds = options.summarizedLorebookIds ?? new Set<string>();
  if (options.macroContext) {
    return entries.flatMap((activatedEntry) =>
      formatLoreGenerationEntryWithMacroContext(activatedEntry, options, summarizedLorebookIds),
    );
  }

  return entries.flatMap((activatedEntry) => {
    const shouldIncludeSummary =
      options.includeSummary && !summarizedLorebookIds.has(activatedEntry.lorebookId);
    const summary = shouldIncludeSummary ? activatedEntry.lorebookSummary.trim() : "";
    const summaryLine = shouldIncludeSummary
      ? loreGenerationSummaryLine(activatedEntry, summary)
      : null;
    if (summaryLine) summarizedLorebookIds.add(activatedEntry.lorebookId);
    const bodyLine = loreGenerationEntryBodyLine(activatedEntry, activatedEntry.entry.body.trim());

    return [...(summaryLine ? [summaryLine] : []), ...(bodyLine ? [bodyLine] : [])];
  });
}

export function finalizeLoreGenerationRuntimeState(
  entriesOrResult: ActivatedLoreEntry[] | ActivatedLoreGenerationResult,
  fallbackRuntimeState: LoreRuntimeState | null = null,
) {
  const entries = Array.isArray(entriesOrResult) ? entriesOrResult : entriesOrResult.entries;
  const runtimeState = Array.isArray(entriesOrResult)
    ? fallbackRuntimeState
    : entriesOrResult.runtimeState;
  const formattingState =
    (Array.isArray(entriesOrResult) ? null : loreGenerationFormattingState(entriesOrResult)) ??
    entries
      .map((entry) => loreGenerationMacroCommit(entry)?.formattingState ?? null)
      .find((state): state is LoreGenerationFormattingState => state !== null) ??
    null;
  if (!formattingState) return runtimeState;

  return finalizeLoreGenerationFormattingRuntimeState(formattingState);
}

function finalizeLoreGenerationFormattingRuntimeState(
  formattingState: LoreGenerationFormattingState,
) {
  let finalizedRuntimeState = formattingState.runtimeState;
  for (const { activatedEntries, lorebook } of formattingState.lorebooks) {
    const unsettledEntry = activatedEntries.find(
      (entry) => !formattingState.settledEntryKeys.has(activatedLoreEntryKey(entry)),
    );
    if (unsettledEntry) {
      throw new Error(
        "Cannot finalize lore runtime state before formatting all macro-activated lore entries.",
      );
    }

    finalizedRuntimeState = updateLoreRuntimeStateFromActivation({
      activatedEntries,
      entryHasBody: loreRuntimeEntryHasSourceBody(activatedEntries),
      keptEntries: activatedEntries.filter((entry) =>
        formattingState.keptEntryKeys.has(activatedLoreEntryKey(entry)),
      ),
      lorebook,
      messageCount: formattingState.messageCount,
      runtimeState: finalizedRuntimeState,
    });
  }

  return finalizedRuntimeState;
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

function groupedAtDepthLoreEntries(
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

  return [...groups.values()];
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
  const groupsByIndex = new Map<
    number,
    { entries: ActivatedLoreEntry[]; role: GenerationPromptMessage["role"] }[]
  >();
  for (const group of groupedAtDepthLoreEntries(entries, options)) {
    const insertionIndex = atDepthInsertionIndex(messages.length, group.depth);
    const existingGroups = groupsByIndex.get(insertionIndex) ?? [];
    existingGroups.push({ entries: group.entries, role: group.role });
    groupsByIndex.set(insertionIndex, existingGroups);
  }

  function formatAtDepthGroup(
    entries: ActivatedLoreEntry[],
    role: GenerationPromptMessage["role"],
  ) {
    const [content] = namedGenerationBlock(
      "Selected lore",
      formatLoreGenerationEntries(entries, options),
    );
    return content?.trim() ? { role, content } : null;
  }

  const result: GenerationPromptMessage[] = [];
  for (let index = 0; index <= messages.length; index += 1) {
    for (const group of groupsByIndex.get(index) ?? []) {
      const formatted = formatAtDepthGroup(group.entries, group.role);
      if (formatted) result.push(formatted);
    }

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

function createGenerationParameters(
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
