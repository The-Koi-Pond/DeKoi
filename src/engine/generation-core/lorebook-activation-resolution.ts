import type { LorebookActivationSettings } from "../contracts/types/lorebook";
import type {
  ActivatedLoreEntry,
  LorebookActivationResult,
  PrimaryMatchCountResult,
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

function resolveInclusionGroups(
  entries: ActivatedLoreEntry[],
  activation: LorebookActivationSettings,
  rand: () => number,
  countPrimaryMatches?: (entry: ActivatedLoreEntry) => PrimaryMatchCountResult,
) {
  const groupsByEntryId = new Map<string, string[]>();
  const entriesByGroup = new Map<string, ActivatedLoreEntry[]>();
  const countedEntriesById = new Map<string, ActivatedLoreEntry>();
  const orderedGroupNames: string[] = [];
  const seenGroupNames = new Set<string>();
  const warnings: string[] = [];
  const entryWithPrimaryMatchCount = (entry: ActivatedLoreEntry) => {
    const countedEntry = countedEntriesById.get(entry.entry.id);
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
    countedEntriesById.set(entry.entry.id, nextEntry);
    return nextEntry;
  };

  for (const entry of entries) {
    const groups = inclusionGroups(entry);
    if (groups.length === 0) continue;
    groupsByEntryId.set(entry.entry.id, groups);
    for (const group of groups) {
      if (!seenGroupNames.has(group)) {
        seenGroupNames.add(group);
        orderedGroupNames.push(group);
      }
      const groupEntries = entriesByGroup.get(group) ?? [];
      groupEntries.push(entry);
      entriesByGroup.set(group, groupEntries);
    }
  }

  const suppressedEntryIds = new Set<string>();
  const resolvedGroups = new Set<string>();

  for (const group of orderedGroupNames) {
    if (resolvedGroups.has(group)) continue;
    const candidates = (entriesByGroup.get(group) ?? []).filter(
      (entry) => !suppressedEntryIds.has(entry.entry.id),
    );
    if (candidates.length <= 1) {
      resolvedGroups.add(group);
      continue;
    }

    const winnerCandidates =
      activation.useGroupScoring && !candidates.some((entry) => entry.entry.prioritizeInclusion)
        ? candidates.map(entryWithPrimaryMatchCount)
        : candidates;
    const winner = chooseInclusionGroupWinner(winnerCandidates, activation, rand);
    if (!winner) continue;

    for (const winnerGroup of groupsByEntryId.get(winner.entry.id) ?? []) {
      resolvedGroups.add(winnerGroup);
      for (const member of entriesByGroup.get(winnerGroup) ?? []) {
        if (member.entry.id !== winner.entry.id) suppressedEntryIds.add(member.entry.id);
      }
    }
  }

  return {
    entries: entries
      .filter((entry) => !suppressedEntryIds.has(entry.entry.id))
      .map((entry) => countedEntriesById.get(entry.entry.id) ?? entry),
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
