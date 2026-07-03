import type { LorebookActivationSettings } from "../contracts/types/lorebook";
import {
  activatedLoreEntryKey,
  type ActivatedLoreEntry,
  type LorebookActivationResult,
  type PrimaryMatchCountResult,
} from "./lorebook-activation-types";

interface FinalizeActivationResultOptions {
  activation: LorebookActivationSettings;
  countPrimaryMatches?: (entry: ActivatedLoreEntry) => PrimaryMatchCountResult;
  entries: ActivatedLoreEntry[];
  rand: () => number;
  warnings: string[];
}

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings)];
}

function stableEntryTiebreaker(left: ActivatedLoreEntry, right: ActivatedLoreEntry) {
  if (left.sourceOrder !== right.sourceOrder) {
    return left.sourceOrder - right.sourceOrder;
  }
  return left.entryIndex - right.entryIndex;
}

export function compareActivatedEntryOrder(left: ActivatedLoreEntry, right: ActivatedLoreEntry) {
  const orderDelta = right.entry.insertionOrder - left.entry.insertionOrder;
  return orderDelta || stableEntryTiebreaker(left, right);
}

function sortActivationResolutionEntries(entries: ActivatedLoreEntry[]) {
  return [...entries].sort(compareActivatedEntryOrder);
}

function inclusionGroups(entry: ActivatedLoreEntry) {
  const groups =
    entry.entry.inclusionGroup
      ?.split(",")
      .map((group) => group.trim())
      .filter(Boolean) ?? [];
  return [...new Set(groups)];
}

function chooseWeightedGroupWinner(entries: ActivatedLoreEntry[], rand: () => number) {
  const weights = entries.map((entry) => entry.entry.groupWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) return entries[0] ?? null;

  const roll = rand() * totalWeight;
  let cursor = 0;
  for (const [index, entry] of entries.entries()) {
    cursor += weights[index] ?? 0;
    if (roll < cursor) return entry;
  }
  return entries.at(-1) ?? null;
}

function pickByHighestInsertionOrder(entries: ActivatedLoreEntry[]) {
  return entries.reduce<ActivatedLoreEntry | null>(
    (winner, entry) =>
      winner === null || entry.entry.insertionOrder > winner.entry.insertionOrder ? entry : winner,
    null,
  );
}

function pickByHighestMatchedKeyCount(entries: ActivatedLoreEntry[]) {
  return entries.reduce<ActivatedLoreEntry | null>(
    (winner, entry) =>
      winner === null || entry.matchedKeyCount > winner.matchedKeyCount ? entry : winner,
    null,
  );
}

function chooseInclusionGroupWinner(
  entries: ActivatedLoreEntry[],
  activation: LorebookActivationSettings,
  rand: () => number,
) {
  if (entries.some((entry) => entry.entry.prioritizeInclusion)) {
    return pickByHighestInsertionOrder(entries);
  }

  if (activation.useGroupScoring) {
    return pickByHighestMatchedKeyCount(entries);
  }

  return chooseWeightedGroupWinner(entries, rand);
}

function collectConnectedInclusionEntries({
  entries,
  entriesByGroup,
  groupsByEntryKey,
  startEntry,
}: {
  entries: ActivatedLoreEntry[];
  entriesByGroup: Map<string, ActivatedLoreEntry[]>;
  groupsByEntryKey: Map<string, string[]>;
  startEntry: ActivatedLoreEntry;
}) {
  const componentEntryKeys = new Set<string>();
  const visitedGroups = new Set<string>();
  const queue: ActivatedLoreEntry[] = [startEntry];

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    if (!entry) continue;
    const entryKey = activatedLoreEntryKey(entry);
    if (componentEntryKeys.has(entryKey)) continue;
    componentEntryKeys.add(entryKey);

    for (const group of groupsByEntryKey.get(entryKey) ?? []) {
      if (visitedGroups.has(group)) continue;
      visitedGroups.add(group);
      queue.push(...(entriesByGroup.get(group) ?? []));
    }
  }

  return entries.filter((entry) => componentEntryKeys.has(activatedLoreEntryKey(entry)));
}

function resolveInclusionGroups(
  entries: ActivatedLoreEntry[],
  activation: LorebookActivationSettings,
  rand: () => number,
  countPrimaryMatches?: (entry: ActivatedLoreEntry) => PrimaryMatchCountResult,
) {
  const groupsByEntryKey = new Map<string, string[]>();
  const entriesByGroup = new Map<string, ActivatedLoreEntry[]>();
  const countedEntriesByKey = new Map<string, ActivatedLoreEntry>();
  const warnings: string[] = [];
  const entryWithPrimaryMatchCount = (entry: ActivatedLoreEntry) => {
    const entryKey = activatedLoreEntryKey(entry);
    const countedEntry = countedEntriesByKey.get(entryKey);
    if (countedEntry) return countedEntry;
    const countResult = countPrimaryMatches?.(entry) ?? {
      matchedKeyCount: entry.matchedKeyCount,
      warnings: [],
    };
    warnings.push(...countResult.warnings);
    const nextEntry = {
      ...entry,
      matchedKeyCount: countResult.matchedKeyCount,
      warnings: uniqueWarnings([...entry.warnings, ...countResult.warnings]),
    };
    countedEntriesByKey.set(entryKey, nextEntry);
    return nextEntry;
  };

  for (const entry of entries) {
    const groups = inclusionGroups(entry);
    if (groups.length === 0) continue;
    groupsByEntryKey.set(activatedLoreEntryKey(entry), groups);
    for (const group of groups) {
      const groupEntries = entriesByGroup.get(group) ?? [];
      groupEntries.push(entry);
      entriesByGroup.set(group, groupEntries);
    }
  }

  const suppressedEntryKeys = new Set<string>();
  const resolvedEntryKeys = new Set<string>();

  for (const entry of entries) {
    const entryKey = activatedLoreEntryKey(entry);
    if (resolvedEntryKeys.has(entryKey) || !groupsByEntryKey.has(entryKey)) continue;
    const componentEntries = collectConnectedInclusionEntries({
      entries,
      entriesByGroup,
      groupsByEntryKey,
      startEntry: entry,
    });
    for (const componentEntry of componentEntries) {
      resolvedEntryKeys.add(activatedLoreEntryKey(componentEntry));
    }

    const candidates = componentEntries.filter(
      (candidate) => !suppressedEntryKeys.has(activatedLoreEntryKey(candidate)),
    );
    if (candidates.length <= 1) continue;

    const winnerCandidates =
      activation.useGroupScoring && !candidates.some((entry) => entry.entry.prioritizeInclusion)
        ? candidates.map(entryWithPrimaryMatchCount)
        : candidates;
    const winner = chooseInclusionGroupWinner(winnerCandidates, activation, rand);
    if (!winner) continue;

    const winnerKey = activatedLoreEntryKey(winner);
    for (const candidate of candidates) {
      const candidateKey = activatedLoreEntryKey(candidate);
      if (candidateKey !== winnerKey) suppressedEntryKeys.add(candidateKey);
    }
  }

  return {
    entries: entries
      .filter((entry) => !suppressedEntryKeys.has(activatedLoreEntryKey(entry)))
      .map((entry) => countedEntriesByKey.get(activatedLoreEntryKey(entry)) ?? entry),
    warnings,
  };
}

function applyProbabilityGate(entries: ActivatedLoreEntry[], rand: () => number) {
  return entries.filter(
    (entry) => entry.entry.probability >= 100 || rand() * 100 < entry.entry.probability,
  );
}

export function finalizeActivationResult({
  activation,
  countPrimaryMatches,
  entries,
  rand,
  warnings,
}: FinalizeActivationResultOptions): LorebookActivationResult {
  const orderedEntries = sortActivationResolutionEntries(entries);
  const groupedEntries = resolveInclusionGroups(
    orderedEntries,
    activation,
    rand,
    countPrimaryMatches,
  );
  return {
    entries: applyProbabilityGate(groupedEntries.entries, rand),
    warnings: uniqueWarnings([...warnings, ...groupedEntries.warnings]),
  };
}
