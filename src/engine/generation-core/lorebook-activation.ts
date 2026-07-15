import {
  resolveEntryTiming,
  resolveEntryRecursion,
  type LoreInsertionStrategy,
  type LoreSourceKind,
  type LorebookRecord,
  type LoreEntryRecord,
  type LoreGenerationTriggerType,
} from "../contracts/types/lorebook";
import type {
  LoreRuntimeEntryState,
  LoreRuntimeState,
} from "../contracts/types/lore-runtime-state";
import { hasActiveLoreRuntimeEntryTimers } from "../lore-runtime/lore-runtime-actions";
import {
  activatedLoreEntryKey,
  type ActivatedLoreEntry,
  type LorebookActivationResult,
} from "./lorebook-activation-types";
import {
  compareActivatedEntryInsertionOrder,
  finalizeActivationResult,
} from "./lorebook-activation-resolution";
import { loreEntryMatchesGenerationContext } from "./lorebook-entry-generation-context";
import {
  createLorebookMatcher,
  emptyMatchSources,
  type LorebookMatcher,
  type LoreMatchSourceBuckets,
  type PrimaryMatchCounter,
} from "./lorebook-matching";

export type { ActivatedLoreEntry, LorebookActivationResult } from "./lorebook-activation-types";

// Pure lorebook activation helpers for generation prompt assembly. This module
// does not know about Messenger, Roleplay, React, storage, or runtime transport.

/** Options for trimming activated lore with absolute or context-percent caps. */
export interface ApplyTokenBudgetOptions {
  budgetTokens?: number | null;
  budgetPercent?: number | null;
  contextTokens?: number | null;
  approxTokens?: (entry: ActivatedLoreEntry) => number;
  reservedTokens?: number;
}

export interface LoreRuntimeStateActivationUpdateOptions {
  lorebook: LorebookRecord;
  runtimeState: LoreRuntimeState | null;
  messageCount?: number | null;
  activatedEntries: ActivatedLoreEntry[];
  keptEntries?: ActivatedLoreEntry[];
  entryHasBody?: (entry: LoreEntryRecord) => boolean;
}

/** Options for lore activation and deterministic test-time random gates. */
export interface LorebookActivationOptions {
  /** Resolved lorebook-source order used as a stable tiebreaker across multiple lorebooks. */
  sourceOrder?: number;
  /** Source bucket that bound this lorebook to the generation context. */
  sourceKind?: LoreSourceKind;
  /** Prebuilt companion/persona source buckets for entries that opt into extra matching. */
  matchSources?: LoreMatchSourceBuckets;
  /** Current thread transcript message count, after any just-submitted user message. */
  messageCount?: number | null;
  /** Concrete generation action currently evaluating lore activation. */
  generationTrigger?: LoreGenerationTriggerType | null;
  /** Character selected to produce this generation, if any. */
  targetCharacterId?: string | null;
  /** Random source used by weighted inclusion groups and probability gates. */
  rand?: () => number;
  /** Already-advanced per-branch mutable lore timer state. Engine treats this as pure input. */
  runtimeState?: LoreRuntimeState | null;
  entryHasBody?: (entry: LoreEntryRecord) => boolean;
  recursionBody?: (entry: ActivatedLoreEntry) => string;
}

interface EntryActivationResult {
  entry: ActivatedLoreEntry | null;
  primaryMatchCounter?: PrimaryMatchCounter;
  warnings: string[];
}

type ActivationSource = ActivatedLoreEntry["activationSource"];
type EntryActivationMode = "activate" | "probe";

interface ActivateEntryOptions {
  entryHasBody?: (entry: LoreEntryRecord) => boolean;
  mode?: EntryActivationMode;
}

const EMPTY_MATCH_SOURCES = emptyMatchSources();
const LOREBOOK_RECURSION_HARD_PASS_CAP = 64;
const LORE_RUNTIME_STATE_ENTRY_SEPARATOR = "\u0000";

function cleanMessageCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function loreRuntimeEntryKey(lorebookId: string, entryId: string) {
  return `${lorebookId}${LORE_RUNTIME_STATE_ENTRY_SEPARATOR}${entryId}`;
}

function entryStateKey(entryState: Pick<LoreRuntimeEntryState, "lorebookId" | "entryId">) {
  return loreRuntimeEntryKey(entryState.lorebookId, entryState.entryId);
}

function decrementRuntimeEntryState(
  entryState: LoreRuntimeEntryState,
  messageDelta: number,
): LoreRuntimeEntryState {
  if (messageDelta <= 0) return entryState;

  return {
    ...entryState,
    stickyRemaining: Math.max(0, entryState.stickyRemaining - messageDelta),
    cooldownRemaining: Math.max(0, entryState.cooldownRemaining - messageDelta),
  };
}

export function advanceLoreRuntimeStateForEvaluation(
  runtimeState: LoreRuntimeState | null | undefined,
  messageCount: number,
) {
  if (!runtimeState) return null;

  const previousMessageCount = cleanMessageCount(runtimeState.lastEvaluatedMessageCount);
  const chatAdvanced = messageCount > previousMessageCount;
  const messageDelta = chatAdvanced ? messageCount - previousMessageCount : 0;
  const entries =
    !chatAdvanced && previousMessageCount > 0
      ? []
      : runtimeState.entries
          .map((entryState) => decrementRuntimeEntryState(entryState, messageDelta))
          .filter(hasActiveLoreRuntimeEntryTimers);

  return {
    ...runtimeState,
    lastEvaluatedMessageCount: messageCount,
    entries,
  };
}

function runtimeEntryStateMatchesEntry(
  entryState: LoreRuntimeEntryState,
  entry: LoreEntryRecord,
  hasBody: (entry: LoreEntryRecord) => boolean,
) {
  return entryState.entryUpdatedAt === entry.updatedAt && entry.enabled && hasBody(entry);
}

function buildRuntimeEntryStateMap(
  runtimeState: LoreRuntimeState | null,
  lorebook: LorebookRecord,
  hasBody: (entry: LoreEntryRecord) => boolean = entryHasBody,
) {
  const entryById = new Map(lorebook.entries.map((entry) => [entry.id, entry]));
  const statesByKey = new Map<string, LoreRuntimeEntryState>();

  for (const entryState of runtimeState?.entries ?? []) {
    if (entryState.lorebookId !== lorebook.id) continue;
    const entry = entryById.get(entryState.entryId);
    if (!entry || !runtimeEntryStateMatchesEntry(entryState, entry, hasBody)) continue;
    statesByKey.set(entryStateKey(entryState), entryState);
  }

  return statesByKey;
}

function timedActivationIsDelayed(entry: LoreEntryRecord, messageCount: number) {
  const timing = resolveEntryTiming(entry);
  return timing.delay > 0 && messageCount < timing.delay;
}

function runtimeStateForEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  context: ActivationEvaluationContext,
) {
  return context.runtimeEntryStates.get(loreRuntimeEntryKey(lorebook.id, entry.id)) ?? null;
}

function entryPassesTimedActivationGate(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  context: ActivationEvaluationContext,
) {
  const entryState = runtimeStateForEntry(lorebook, entry, context);
  if (entryState?.cooldownRemaining && entryState.cooldownRemaining > 0) return false;
  return !timedActivationIsDelayed(entry, context.messageCount);
}

function entryHasBody(entry: LoreEntryRecord) {
  return entry.body.trim().length > 0;
}

function entryHasActivationPath(entry: LoreEntryRecord) {
  return (
    entry.strategy === "constant" || (entry.key?.some((key) => key.trim().length > 0) ?? false)
  );
}

function entryCanPossiblyActivateWithBody(
  entry: LoreEntryRecord,
  hasBody: (entry: LoreEntryRecord) => boolean,
) {
  return entry.enabled && hasBody(entry) && entryHasActivationPath(entry);
}

function entryCanPossiblyActivateFromRecursion(
  entry: LoreEntryRecord,
  hasBody: (entry: LoreEntryRecord) => boolean,
) {
  return (
    entryCanPossiblyActivateWithBody(entry, hasBody) && !resolveEntryRecursion(entry).nonRecursable
  );
}

function entryCanActivateFromSource(
  entry: LoreEntryRecord,
  activationSource: ActivationSource,
  recursionLevel: number,
) {
  const recursion = resolveEntryRecursion(entry);
  if (activationSource === "direct") return !recursion.delayUntilRecursion;
  if (recursion.nonRecursable) return false;
  return !recursion.delayUntilRecursion || recursionLevel >= recursion.recursionLevel;
}

function entryBelongsToInclusionGroup(entry: LoreEntryRecord) {
  return entry.inclusionGroup?.split(",").some((group) => group.trim().length > 0) ?? false;
}

function activateEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  sourceOrder: number,
  entryIndex: number,
  sourceKind: LoreSourceKind,
  scanBuffer: string,
  matchSources: LoreMatchSourceBuckets,
  matcher: LorebookMatcher,
  activationSource: ActivationSource,
  recursionLevel: number,
  options: ActivateEntryOptions = {},
): EntryActivationResult {
  const hasBody = options.entryHasBody ?? entryHasBody;
  if (!entry.enabled || !hasBody(entry)) {
    return { entry: null, warnings: [] };
  }
  if (!entryCanActivateFromSource(entry, activationSource, recursionLevel)) {
    return { entry: null, warnings: [] };
  }
  if (entry.strategy === "constant") {
    const entryRecursionLevel = activationSource === "recursion" ? recursionLevel : null;
    return {
      entry: {
        lorebookId: lorebook.id,
        lorebookTitle: lorebook.title,
        lorebookSummary: lorebook.summary,
        entry,
        matchReason: "constant",
        activationSource,
        matchedKey: null,
        matchedKeyCount: 0,
        warnings: [],
        sourceOrder,
        sourceKind,
        entryIndex,
        recursionLevel: entryRecursionLevel,
      },
      warnings: [],
    };
  }

  const match = matcher({
    activation: lorebook.activation,
    baseScanBuffer: scanBuffer,
    countPrimaryMatches:
      options.mode !== "probe" &&
      lorebook.activation.useGroupScoring &&
      entryBelongsToInclusionGroup(entry),
    entry,
    matchSources,
  });
  if (match.matchedKey === null) return { entry: null, warnings: match.warnings };
  const entryRecursionLevel = activationSource === "recursion" ? recursionLevel : null;
  const activatedEntry: ActivatedLoreEntry = {
    lorebookId: lorebook.id,
    lorebookTitle: lorebook.title,
    lorebookSummary: lorebook.summary,
    entry,
    matchReason: "primary-key",
    activationSource,
    matchedKey: match.matchedKey,
    matchedKeyCount: 1,
    warnings: match.warnings,
    sourceOrder,
    sourceKind,
    entryIndex,
    recursionLevel: entryRecursionLevel,
  };
  return {
    ...(match.primaryMatchCounter ? { primaryMatchCounter: match.primaryMatchCounter } : {}),
    entry: activatedEntry,
    warnings: match.warnings,
  };
}

export function sortActivatedEntriesForInsertion(
  entries: ActivatedLoreEntry[],
  strategy: LoreInsertionStrategy = "sorted-evenly",
) {
  return [...entries].sort((left, right) =>
    compareActivatedEntryInsertionOrder(left, right, strategy),
  );
}

function budgetPriorityRank(entry: ActivatedLoreEntry) {
  const sourceRank = entry.activationSource === "direct" ? 0 : 1;
  const strategyRank = entry.entry.strategy === "constant" ? 0 : 1;
  return sourceRank * 2 + strategyRank;
}

export function compareActivatedEntryBudgetPriority(
  left: ActivatedLoreEntry,
  right: ActivatedLoreEntry,
) {
  const priorityDelta = budgetPriorityRank(left) - budgetPriorityRank(right);
  return priorityDelta || compareActivatedEntryInsertionOrder(left, right);
}

function budgetPriorityEntries(entries: ActivatedLoreEntry[]) {
  return [...entries].sort(compareActivatedEntryBudgetPriority);
}

function approximateLoreEntryTokens(entry: ActivatedLoreEntry) {
  const promptText = `${entry.lorebookTitle} / ${entry.entry.title}: ${entry.entry.body.trim()}`;
  return Math.ceil(promptText.length / 4);
}

function resolveTokenBudget({
  budgetPercent,
  budgetTokens,
  contextTokens,
}: ApplyTokenBudgetOptions) {
  if (typeof budgetTokens === "number" && Number.isFinite(budgetTokens) && budgetTokens >= 0) {
    return Math.trunc(budgetTokens);
  }

  if (
    typeof budgetPercent === "number" &&
    Number.isFinite(budgetPercent) &&
    budgetPercent >= 0 &&
    typeof contextTokens === "number" &&
    Number.isFinite(contextTokens) &&
    contextTokens >= 0
  ) {
    return Math.trunc((contextTokens * Math.min(100, budgetPercent)) / 100);
  }

  return null;
}

/**
 * Applies a lore budget with a cheap token estimate. DeKoi currently has no
 * tokenizer dependency, so the default estimate is roughly chars / 4. Percent
 * budgets are only resolved when caller-provided context size is known. Budget
 * priority keeps direct activations before recursive activations, and constants
 * before selective entries within each direct/recursive group.
 */
export function applyTokenBudget(entries: ActivatedLoreEntry[], options: ApplyTokenBudgetOptions) {
  const budget = resolveTokenBudget(options);
  if (budget === null) return sortActivatedEntriesForInsertion(entries);

  const approxTokens = options.approxTokens ?? approximateLoreEntryTokens;
  const kept: ActivatedLoreEntry[] = [];
  let usedTokens =
    typeof options.reservedTokens === "number" && Number.isFinite(options.reservedTokens)
      ? Math.max(0, Math.ceil(options.reservedTokens))
      : 0;

  for (const entry of budgetPriorityEntries(entries)) {
    const entryTokens = Math.max(0, Math.ceil(approxTokens(entry)));
    if (usedTokens + entryTokens > budget) continue;
    kept.push(entry);
    usedTokens += entryTokens;
  }

  return sortActivatedEntriesForInsertion(kept);
}

/**
 * Returns enabled, non-empty lore entries that activate against the provided
 * transcript scan text plus any supplied per-entry additional match sources,
 * including provenance for later prompt/debug surfaces. When the lorebook
 * enables recursive scans, activated entry bodies can activate further eligible
 * entries until no candidates remain or a recursion pass cap is reached. The
 * final activation result then resolves inclusion groups and applies per-entry
 * probability before callers apply budget trimming.
 */
export function activateLorebookEntries(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: LorebookActivationOptions = {},
) {
  return activateLorebookEntriesWithWarnings(lorebook, scanBuffer, options).entries;
}

interface ActivationEvaluationContext {
  generationTrigger: LoreGenerationTriggerType | null;
  messageCount: number;
  sourceOrder: number;
  sourceKind: LoreSourceKind;
  matchSources: LoreMatchSourceBuckets;
  matcher: LorebookMatcher;
  primaryMatchCounters: Map<string, PrimaryMatchCounter>;
  runtimeEntryStates: Map<string, LoreRuntimeEntryState>;
  runtimeState: LoreRuntimeState | null;
  targetCharacterId: string | null;
  entryHasBody: (entry: LoreEntryRecord) => boolean;
  recursionBody: (entry: ActivatedLoreEntry) => string;
}

function createStickyActivatedEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  sourceOrder: number,
  entryIndex: number,
  sourceKind: LoreSourceKind,
): ActivatedLoreEntry {
  return {
    lorebookId: lorebook.id,
    lorebookTitle: lorebook.title,
    lorebookSummary: lorebook.summary,
    entry,
    matchReason: "sticky",
    activationSource: "direct",
    matchedKey: null,
    matchedKeyCount: 0,
    warnings: [],
    sourceOrder,
    sourceKind,
    entryIndex,
    recursionLevel: null,
  };
}

function runDirectScan(
  lorebook: LorebookRecord,
  scanBuffer: string,
  context: ActivationEvaluationContext,
): LorebookActivationResult {
  const entries: ActivatedLoreEntry[] = [];
  const warnings: string[] = [];

  for (const [entryIndex, entry] of lorebook.entries.entries()) {
    if (!loreEntryMatchesGenerationContext(entry, context)) continue;
    const entryState = runtimeStateForEntry(lorebook, entry, context);
    if (entryState?.stickyRemaining && entryState.stickyRemaining > 0) {
      const stickyEntry = createStickyActivatedEntry(
        lorebook,
        entry,
        context.sourceOrder,
        entryIndex,
        context.sourceKind,
      );
      entries.push(stickyEntry);
      continue;
    }

    if (!entryPassesTimedActivationGate(lorebook, entry, context)) {
      continue;
    }

    const activation = activateEntry(
      lorebook,
      entry,
      context.sourceOrder,
      entryIndex,
      context.sourceKind,
      scanBuffer,
      context.matchSources,
      context.matcher,
      "direct",
      0,
      { entryHasBody: context.entryHasBody },
    );
    warnings.push(...activation.warnings);
    if (activation.entry) {
      entries.push(activation.entry);
      if (activation.primaryMatchCounter) {
        context.primaryMatchCounters.set(
          activatedLoreEntryKey(activation.entry),
          activation.primaryMatchCounter,
        );
      }
    }
  }

  return { entries, warnings, runtimeState: context.runtimeState };
}

function recursionScanBodies(
  entries: ActivatedLoreEntry[],
  selectBody: (entry: ActivatedLoreEntry) => string = (entry) => entry.entry.body,
) {
  return entries
    .filter((entry) => !resolveEntryRecursion(entry.entry).preventFurther)
    .map((entry) => selectBody(entry).trim())
    .filter(Boolean);
}

function entryWouldActivateFromRecursion(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  entryIndex: number,
  scanBuffer: string,
  context: ActivationEvaluationContext,
  recursionLevel: number,
) {
  if (!loreEntryMatchesGenerationContext(entry, context)) return false;
  if (!entryCanPossiblyActivateFromRecursion(entry, context.entryHasBody)) return false;
  if (!entryPassesTimedActivationGate(lorebook, entry, context)) return false;
  return (
    activateEntry(
      lorebook,
      entry,
      context.sourceOrder,
      entryIndex,
      context.sourceKind,
      scanBuffer,
      context.matchSources,
      context.matcher,
      "recursion",
      recursionLevel,
      { entryHasBody: context.entryHasBody, mode: "probe" },
    ).entry !== null
  );
}

function nextDelayedRecursionLevel(
  lorebook: LorebookRecord,
  activeEntryIds: Set<string>,
  currentLevel: number,
  recursionScanBuffer: string,
  context: ActivationEvaluationContext,
) {
  return lorebook.entries.reduce<number | null>((nextLevel, entry, entryIndex) => {
    if (activeEntryIds.has(entry.id)) return nextLevel;
    if (!entryCanPossiblyActivateFromRecursion(entry, context.entryHasBody)) return nextLevel;
    const recursion = resolveEntryRecursion(entry);
    if (!recursion.delayUntilRecursion) return nextLevel;
    if (recursion.recursionLevel <= currentLevel) return nextLevel;
    if (
      !entryWouldActivateFromRecursion(
        lorebook,
        entry,
        entryIndex,
        recursionScanBuffer,
        context,
        recursion.recursionLevel,
      )
    ) {
      return nextLevel;
    }
    return nextLevel === null
      ? recursion.recursionLevel
      : Math.min(nextLevel, recursion.recursionLevel);
  }, null);
}

function hasRemainingRecursionCandidate(
  lorebook: LorebookRecord,
  activeEntryIds: Set<string>,
  recursionScanBuffer: string,
  context: ActivationEvaluationContext,
  recursionLevel: number,
) {
  return lorebook.entries.some(
    (entry, entryIndex) =>
      !activeEntryIds.has(entry.id) &&
      entryWouldActivateFromRecursion(
        lorebook,
        entry,
        entryIndex,
        recursionScanBuffer,
        context,
        recursionLevel,
      ),
  );
}

function runRecursionPasses({
  context,
  entries,
  lorebook,
  scanBuffer,
  warnings,
}: {
  context: ActivationEvaluationContext;
  entries: ActivatedLoreEntry[];
  lorebook: LorebookRecord;
  scanBuffer: string;
  warnings: string[];
}): LorebookActivationResult {
  const activeEntryIds = new Set(entries.map((entry) => entry.entry.id));
  const recursionBodies = recursionScanBodies(entries, context.recursionBody);
  if (recursionBodies.length === 0) {
    return { entries, warnings, runtimeState: context.runtimeState };
  }

  let recursionScanBuffer = [scanBuffer.trim(), ...recursionBodies].filter(Boolean).join("\n");
  let recursionLevel = 0;
  let passCount = 0;
  const maxRecursionSteps = lorebook.activation.maxRecursionSteps;

  while (true) {
    if (maxRecursionSteps > 0 && passCount >= maxRecursionSteps) break;
    if (passCount >= LOREBOOK_RECURSION_HARD_PASS_CAP) {
      warnings.push(
        `Lorebook "${lorebook.title}" recursion stopped after ${LOREBOOK_RECURSION_HARD_PASS_CAP} passes.`,
      );
      break;
    }

    const recursiveEntries: ActivatedLoreEntry[] = [];

    for (const [entryIndex, entry] of lorebook.entries.entries()) {
      if (activeEntryIds.has(entry.id)) continue;
      if (!loreEntryMatchesGenerationContext(entry, context)) continue;
      if (!entryPassesTimedActivationGate(lorebook, entry, context)) continue;
      const activation = activateEntry(
        lorebook,
        entry,
        context.sourceOrder,
        entryIndex,
        context.sourceKind,
        recursionScanBuffer,
        context.matchSources,
        context.matcher,
        "recursion",
        recursionLevel,
        { entryHasBody: context.entryHasBody },
      );
      warnings.push(...activation.warnings);
      if (!activation.entry) continue;
      recursiveEntries.push(activation.entry);
      if (activation.primaryMatchCounter) {
        context.primaryMatchCounters.set(
          activatedLoreEntryKey(activation.entry),
          activation.primaryMatchCounter,
        );
      }
      activeEntryIds.add(entry.id);
    }

    // This cap counts every recursion sweep, including sweeps that only open
    // the next delayed level. That keeps delayed level ladders bounded too.
    passCount += 1;

    if (recursiveEntries.length > 0) {
      entries.push(...recursiveEntries);
      const newBodies = recursionScanBodies(recursiveEntries, context.recursionBody);
      if (newBodies.length > 0) {
        recursionScanBuffer = [recursionScanBuffer, ...newBodies].join("\n");
        if (
          hasRemainingRecursionCandidate(
            lorebook,
            activeEntryIds,
            recursionScanBuffer,
            context,
            recursionLevel,
          )
        ) {
          continue;
        }
      }
    }

    const nextRecursionLevel = nextDelayedRecursionLevel(
      lorebook,
      activeEntryIds,
      recursionLevel,
      recursionScanBuffer,
      context,
    );
    if (nextRecursionLevel === null) break;
    recursionLevel = nextRecursionLevel;
  }

  return { entries, warnings, runtimeState: context.runtimeState };
}

export function updateLoreRuntimeStateFromActivation({
  activatedEntries,
  keptEntries = activatedEntries,
  lorebook,
  messageCount,
  runtimeState,
  entryHasBody: runtimeEntryHasBody = entryHasBody,
}: LoreRuntimeStateActivationUpdateOptions) {
  if (!runtimeState) return null;

  const runtimeEntryStates = buildRuntimeEntryStateMap(runtimeState, lorebook, runtimeEntryHasBody);
  const keptEntriesByKey = new Map(
    keptEntries.map((activatedEntry) => [activatedLoreEntryKey(activatedEntry), activatedEntry]),
  );
  const keptEntryKeys = new Set(keptEntriesByKey.keys());
  const trimmedEntryKeys = new Set(
    activatedEntries
      .map((activatedEntry) => activatedLoreEntryKey(activatedEntry))
      .filter((entryKey) => !keptEntryKeys.has(entryKey)),
  );
  const nextEntries = runtimeState.entries.filter(
    (entryState) => entryState.lorebookId !== lorebook.id,
  );

  for (const entry of lorebook.entries) {
    const key = loreRuntimeEntryKey(lorebook.id, entry.id);
    const activatedEntry = keptEntriesByKey.get(key);
    const existingState = runtimeEntryStates.get(key);

    if (!activatedEntry) {
      if (trimmedEntryKeys.has(key) && existingState) {
        const cooldownOnlyState = { ...existingState, stickyRemaining: 0 };
        if (hasActiveLoreRuntimeEntryTimers(cooldownOnlyState)) {
          nextEntries.push(cooldownOnlyState);
        }
        continue;
      }
      if (existingState && hasActiveLoreRuntimeEntryTimers(existingState)) {
        nextEntries.push(existingState);
      }
      continue;
    }

    if (activatedEntry.matchReason === "sticky" && existingState) {
      if (hasActiveLoreRuntimeEntryTimers(existingState)) {
        nextEntries.push(existingState);
      }
      continue;
    }

    const timing = resolveEntryTiming(entry);
    if (timing.sticky <= 0 && timing.cooldown <= 0) continue;

    nextEntries.push({
      lorebookId: lorebook.id,
      entryId: entry.id,
      entryUpdatedAt: entry.updatedAt,
      activatedAtMessageIndex: cleanMessageCount(messageCount),
      stickyRemaining: timing.sticky,
      cooldownRemaining: timing.cooldown,
    });
  }

  return {
    ...runtimeState,
    entries: nextEntries.filter(hasActiveLoreRuntimeEntryTimers),
    lastEvaluatedMessageCount: cleanMessageCount(messageCount),
  };
}

function withLoreRuntimeState(
  result: Pick<LorebookActivationResult, "entries" | "warnings">,
  context: ActivationEvaluationContext,
  lorebook: LorebookRecord,
): LorebookActivationResult {
  return {
    ...result,
    runtimeState: updateLoreRuntimeStateFromActivation({
      activatedEntries: result.entries,
      entryHasBody: context.entryHasBody,
      lorebook,
      messageCount: context.messageCount,
      runtimeState: context.runtimeState,
    }),
  };
}

export function activateLorebookEntriesWithWarnings(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: LorebookActivationOptions = {},
): LorebookActivationResult {
  const rand = options.rand ?? Math.random;
  const messageCount = cleanMessageCount(options.messageCount);
  const runtimeState = options.runtimeState ?? null;
  const context: ActivationEvaluationContext = {
    generationTrigger: options.generationTrigger ?? null,
    messageCount,
    sourceOrder: options.sourceOrder ?? 0,
    sourceKind: options.sourceKind ?? "chat",
    matchSources: options.matchSources ?? EMPTY_MATCH_SOURCES,
    matcher: createLorebookMatcher(),
    primaryMatchCounters: new Map(),
    runtimeEntryStates: buildRuntimeEntryStateMap(
      runtimeState,
      lorebook,
      options.entryHasBody ?? entryHasBody,
    ),
    runtimeState,
    targetCharacterId: options.targetCharacterId ?? null,
    entryHasBody: options.entryHasBody ?? entryHasBody,
    recursionBody: options.recursionBody ?? ((entry) => entry.entry.body),
  };
  const countPrimaryMatches = (entry: ActivatedLoreEntry) =>
    context.primaryMatchCounters.get(activatedLoreEntryKey(entry))?.() ?? {
      matchedKeyCount: entry.matchedKeyCount,
      warnings: [],
    };
  const { entries, warnings } = runDirectScan(lorebook, scanBuffer, context);

  if (!lorebook.activation.recursiveScan || entries.length === 0) {
    return withLoreRuntimeState(
      finalizeActivationResult({
        activation: lorebook.activation,
        countPrimaryMatches,
        entries,
        rand,
        warnings,
      }),
      context,
      lorebook,
    );
  }

  const activation = runRecursionPasses({ context, entries, lorebook, scanBuffer, warnings });
  return withLoreRuntimeState(
    finalizeActivationResult({
      activation: lorebook.activation,
      countPrimaryMatches,
      entries: activation.entries,
      rand,
      warnings: activation.warnings,
    }),
    context,
    lorebook,
  );
}
