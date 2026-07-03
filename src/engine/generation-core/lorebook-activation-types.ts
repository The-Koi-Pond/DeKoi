import type { LoreEntryRecord } from "../contracts/types/lorebook";

/** Activated entry plus match provenance, ordering, and summary metadata. */
export interface ActivatedLoreEntry {
  lorebookId: string;
  lorebookTitle: string;
  lorebookSummary: string;
  entry: LoreEntryRecord;
  matchReason: "constant" | "primary-key";
  activationSource: "direct" | "recursion";
  matchedKey: string | null;
  matchedKeyCount: number;
  warnings: string[];
  sourceOrder: number;
  entryIndex: number;
  recursionLevel: number | null;
}

/** Activated lore entries plus non-fatal warnings discovered during activation. */
export interface LorebookActivationResult {
  entries: ActivatedLoreEntry[];
  warnings: string[];
}

export interface PrimaryMatchCountResult {
  matchedKeyCount: number;
  warnings: string[];
}

export function activatedLoreEntryKey(entry: Pick<ActivatedLoreEntry, "lorebookId" | "entry">) {
  return `${entry.lorebookId}\u0000${entry.entry.id}`;
}
