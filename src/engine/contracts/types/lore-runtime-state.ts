export type LoreRuntimeStateOwnerKind = "mode-branch";

/** Mutable timer state for one lorebook entry in one owner branch. */
export interface LoreRuntimeEntryState {
  lorebookId: string;
  entryId: string;
  /** Lore entry updatedAt used to discard stale timers after entry edits. */
  entryUpdatedAt: string;
  /** Non-empty transcript count when the entry last activated. */
  activatedAtMessageIndex: number;
  stickyRemaining: number;
  cooldownRemaining: number;
}

/** Per-branch durable state for lorebook sticky and cooldown timers. */
export interface LoreRuntimeState {
  id: string;
  schemaVersion: 1;
  ownerKind: LoreRuntimeStateOwnerKind;
  ownerId: string;
  /** Last non-empty transcript count used to advance entry timers. */
  lastEvaluatedMessageCount: number;
  entries: LoreRuntimeEntryState[];
  createdAt: string;
  updatedAt: string;
}
