import { describe, expect, it } from "vitest";

import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import {
  deleteLoreRuntimeStateForOwner,
  selectLoreRuntimeState,
  upsertLoreRuntimeState,
} from "./lore-runtime-actions";

const now = "2026-07-02T00:00:00.000Z";

function state(input: Partial<LoreRuntimeState>): LoreRuntimeState {
  return {
    id: "state-1",
    schemaVersion: 1,
    ownerKind: "messenger-thread",
    ownerId: "thread-1",
    lastEvaluatedMessageCount: 0,
    entries: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

describe("lore runtime actions", () => {
  it("selects a runtime state by owner", () => {
    const selected = state({ id: "selected", ownerId: "thread-selected" });

    expect(
      selectLoreRuntimeState({
        loreRuntimeStates: [state({ id: "other" }), selected],
        ownerKind: "messenger-thread",
        ownerId: "thread-selected",
      }),
    ).toBe(selected);
  });

  it("upserts one active state per owner", () => {
    const next = state({
      id: "next",
      entries: [
        {
          lorebookId: "lorebook-1",
          entryId: "entry-1",
          entryUpdatedAt: now,
          activatedAtMessageIndex: 2,
          stickyRemaining: 1,
          cooldownRemaining: 0,
        },
      ],
    });

    expect(
      upsertLoreRuntimeState(
        [state({ id: "old-same-owner" }), state({ id: "other-owner", ownerId: "thread-2" })],
        next,
      ).map((item) => item.id),
    ).toEqual(["next", "other-owner"]);
  });

  it("deletes owner state when upserting an empty timer state", () => {
    expect(
      upsertLoreRuntimeState(
        [state({ id: "old-same-owner" }), state({ id: "other-owner", ownerId: "thread-2" })],
        state({ id: "next" }),
      ).map((item) => item.id),
    ).toEqual(["other-owner"]);
  });

  it("deletes all runtime states for an owner", () => {
    expect(
      deleteLoreRuntimeStateForOwner(
        [state({ id: "first" }), state({ id: "second" }), state({ id: "other", ownerId: "x" })],
        "messenger-thread",
        "thread-1",
      ).map((item) => item.id),
    ).toEqual(["other"]);
  });
});
