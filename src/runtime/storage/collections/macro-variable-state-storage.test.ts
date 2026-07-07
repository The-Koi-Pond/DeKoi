import { describe, expect, it } from "vitest";

import { normalizeMacroVariableScope } from "./macro-variable-state-storage";

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeMacroVariableScope", () => {
  it("normalizes owner scope variables to string values with trimmed names", () => {
    const record = normalizeMacroVariableScope({
      id: "macro-variable-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      variables: {
        " mood ": "calm",
        count: 3,
        blank: null,
        " ": "dropped",
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toEqual({
      id: "macro-variable-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      variables: {
        mood: "calm",
        count: "",
        blank: "",
      },
      createdAt: now,
      updatedAt: now,
    });
  });

  it("canonicalizes global owner ID and rejects malformed owner/schema values", () => {
    expect(
      normalizeMacroVariableScope({
        id: "macro-variable-state-global",
        schemaVersion: 1,
        ownerKind: "global",
        ownerId: "hand-edited-global",
        variables: {},
      }),
    ).toEqual(expect.objectContaining({ ownerKind: "global", ownerId: "global" }));
    expect(
      normalizeMacroVariableScope({
        id: "state",
        schemaVersion: 2,
        ownerKind: "messenger-thread",
        ownerId: "thread",
      }),
    ).toBeNull();
    expect(
      normalizeMacroVariableScope({
        id: "state",
        schemaVersion: 1,
        ownerKind: "unknown",
        ownerId: "thread",
      }),
    ).toBeNull();
  });
});
