import { describe, expect, it } from "vitest";

import type { MacroVariableScope } from "../contracts/types/macro-variables";
import {
  buildGenerationMacroVariableState,
  commitGenerationMacroVariableStates,
} from "./macro-variable-actions";

const now = "2026-07-06T00:00:00.000Z";

function scope(input: Partial<MacroVariableScope> & Pick<MacroVariableScope, "id">) {
  return {
    schemaVersion: 1,
    ownerKind: "messenger-thread",
    ownerId: "thread-1",
    variables: {},
    createdAt: now,
    updatedAt: now,
    ...input,
  } satisfies MacroVariableScope;
}

describe("macro variable generation state", () => {
  it("preserves global variables shadowed by thread variables", () => {
    const macroVariableStates = [
      scope({
        id: "global-state",
        ownerKind: "global",
        ownerId: "global",
        variables: { mood: "global-calm", day: "Monday" },
      }),
      scope({
        id: "thread-state",
        variables: { mood: "thread-tense" },
      }),
    ];
    const selection = buildGenerationMacroVariableState({
      macroVariableStates,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    expect(selection.variables).toEqual({ mood: "thread-tense", day: "Monday" });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [
        { kind: "set", name: "mood", value: "thread-settled" },
        { kind: "set", name: "day", value: "Tuesday" },
        { kind: "set", name: "newFlag", value: "yes" },
      ],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: macroVariableStates.map((state) =>
        state.id === "thread-state"
          ? { ...state, variables: { ...state.variables, other: "latest" } }
          : state,
      ),
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: true,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates.find((state) => state.id === "global-state")?.variables).toEqual({
      mood: "global-calm",
      day: "Tuesday",
    });
    expect(committedStates.find((state) => state.id === "thread-state")?.variables).toEqual({
      mood: "thread-settled",
      other: "latest",
      newFlag: "yes",
    });
  });

  it("does not overwrite same-key latest values when no mutation targeted that key", () => {
    const macroVariableStates = [
      scope({
        id: "thread-state",
        variables: { mood: "thread-tense", count: "1" },
      }),
    ];
    const selection = buildGenerationMacroVariableState({
      macroVariableStates,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [{ kind: "add", name: "count", delta: 2 }],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: [
        scope({
          id: "thread-state",
          variables: { mood: "latest-manual-edit", count: "10" },
        }),
      ],
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: true,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates.find((state) => state.id === "thread-state")?.variables).toEqual({
      mood: "latest-manual-edit",
      count: "12",
    });
  });

  it("creates an owner scope for the first owner mutation when the owner still exists", () => {
    const selection = buildGenerationMacroVariableState({
      macroVariableStates: [],
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [{ kind: "set", name: "mood", value: "thread-settled" }],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: [],
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: true,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates).toEqual([
      {
        id: "macro-variable-state-new",
        schemaVersion: 1,
        ownerKind: "messenger-thread",
        ownerId: "thread-1",
        variables: { mood: "thread-settled" },
        createdAt: "2026-07-06T01:00:00.000Z",
        updatedAt: "2026-07-06T01:00:00.000Z",
      },
    ]);
  });

  it("does not create a first owner scope when the owner was removed before commit", () => {
    const selection = buildGenerationMacroVariableState({
      macroVariableStates: [],
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [{ kind: "set", name: "mood", value: "thread-settled" }],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: [],
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: false,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates).toEqual([]);
  });

  it("does not recreate an owner scope removed while generation was in flight", () => {
    const macroVariableStates = [
      scope({
        id: "thread-state",
        variables: { mood: "thread-tense" },
      }),
    ];
    const selection = buildGenerationMacroVariableState({
      macroVariableStates,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [{ kind: "set", name: "mood", value: "thread-settled" }],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: [],
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: true,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates).toEqual([]);
  });

  it("does not recreate a global scope removed while generation was in flight", () => {
    const macroVariableStates = [
      scope({
        id: "global-state",
        ownerKind: "global",
        ownerId: "global",
        variables: { day: "Monday" },
      }),
    ];
    const selection = buildGenerationMacroVariableState({
      macroVariableStates,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
    });

    const committedStates = commitGenerationMacroVariableStates({
      variableMutations: [{ kind: "set", name: "day", value: "Tuesday" }],
      createId: (prefix) => `${prefix}-new`,
      macroVariableStates: [],
      now: "2026-07-06T01:00:00.000Z",
      ownerExists: true,
      ownerKind: "messenger-thread",
      ownerId: "thread-1",
      selection,
    });

    expect(committedStates).toEqual([]);
  });
});
