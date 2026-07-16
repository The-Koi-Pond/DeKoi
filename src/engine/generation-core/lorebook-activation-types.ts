import type { LoreEntryRecord, LoreSourceKind } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";

/** Activated entry plus match provenance, ordering, and summary metadata. */
export interface ActivatedLoreEntry {
  lorebookId: string;
  lorebookTitle: string;
  lorebookSummary: string;
  entry: LoreEntryRecord;
  matchReason: "constant" | "primary-key" | "sticky";
  activationSource: "direct" | "recursion";
  matchedKey: string | null;
  matchedKeyCount: number;
  warnings: string[];
  sourceOrder: number;
  sourceKind: LoreSourceKind;
  entryIndex: number;
  recursionLevel: number | null;
}

/** Activated lore entries plus non-fatal warnings discovered during activation. */
export interface LorebookActivationResult {
  entries: ActivatedLoreEntry[];
  warnings: string[];
  runtimeState: LoreRuntimeState | null;
}

export function activatedLoreEntryKey(entry: Pick<ActivatedLoreEntry, "lorebookId" | "entry">) {
  return `${entry.lorebookId}\u0000${entry.entry.id}`;
}
