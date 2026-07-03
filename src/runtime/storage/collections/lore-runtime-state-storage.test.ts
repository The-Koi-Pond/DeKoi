import { describe, expect, it } from "vitest";

import { normalizeLoreRuntimeState } from "./lore-runtime-state-storage";

describe("normalizeLoreRuntimeState", () => {
  it("normalizes valid timer state and filters duplicate or invalid entries", () => {
    const record = normalizeLoreRuntimeState({
      id: "lore-runtime-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      lastEvaluatedMessageCount: 4.9,
      entries: [
        {
          lorebookId: "lorebook-1",
          entryId: "entry-1",
          entryUpdatedAt: "2026-07-02T00:00:00.000Z",
          activatedAtMessageIndex: -1,
          stickyRemaining: 2.9,
          cooldownRemaining: -5,
        },
        {
          lorebookId: "lorebook-1",
          entryId: "entry-1",
          entryUpdatedAt: "2026-07-02T00:00:00.000Z",
          activatedAtMessageIndex: 9,
          stickyRemaining: 9,
          cooldownRemaining: 9,
        },
        {
          lorebookId: "",
          entryId: "entry-2",
          entryUpdatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    });

    expect(record).toEqual({
      id: "lore-runtime-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      lastEvaluatedMessageCount: 4,
      entries: [
        {
          lorebookId: "lorebook-1",
          entryId: "entry-1",
          entryUpdatedAt: "2026-07-02T00:00:00.000Z",
          activatedAtMessageIndex: 0,
          stickyRemaining: 2,
          cooldownRemaining: 0,
        },
      ],
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    });
  });

  it("rejects malformed owner and schema values", () => {
    expect(
      normalizeLoreRuntimeState({
        id: "state",
        schemaVersion: 2,
        ownerKind: "messenger-thread",
        ownerId: "thread",
      }),
    ).toBeNull();
    expect(
      normalizeLoreRuntimeState({
        id: "state",
        schemaVersion: 1,
        ownerKind: "unknown",
        ownerId: "thread",
      }),
    ).toBeNull();
  });
});
