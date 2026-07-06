import { describe, expect, it } from "vitest";

import {
  createLorebookEntryRecord,
  createLorebookRecord,
  updateLorebookEntryRecord,
  updateLorebookRecord,
} from "./lorebook-actions";
import { DEFAULT_LOREBOOK_ACTIVATION } from "../contracts/types/lorebook";

describe("lorebook actions", () => {
  it("normalizes invalid activation numbers when creating lorebooks", () => {
    const lorebook = createLorebookRecord({
      id: "lorebook-under-test",
      input: {
        title: "Activation Contract",
        activation: {
          scanDepth: -1,
          maxRecursionSteps: Number.NaN,
          budgetTokens: Number.POSITIVE_INFINITY,
          budgetPercent: 500,
        },
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    expect(lorebook.activation).toEqual({
      ...DEFAULT_LOREBOOK_ACTIVATION,
      budgetPercent: 100,
    });
  });

  it("preserves valid activation values when update patches are invalid", () => {
    const lorebook = createLorebookRecord({
      id: "lorebook-under-test",
      input: {
        title: "Activation Contract",
        activation: {
          scanDepth: 4,
          maxRecursionSteps: 8,
          useGroupScoring: true,
          budgetTokens: 512,
          budgetPercent: 50,
        },
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    const updated = updateLorebookRecord(
      lorebook,
      {
        title: lorebook.title,
        activation: {
          scanDepth: Number.NEGATIVE_INFINITY,
          maxRecursionSteps: -2,
          budgetTokens: -1,
          budgetPercent: Number.NaN,
        },
      },
      "2026-06-24T08:00:00.000Z",
    );

    expect(updated.activation).toMatchObject({
      scanDepth: 4,
      maxRecursionSteps: 8,
      useGroupScoring: true,
      budgetTokens: 512,
      budgetPercent: 50,
    });
  });
});

describe("lorebook entry actions", () => {
  it("dedupes trimmed trigger keys when creating entries", () => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Triggered Entry",
        key: [" dragon ", "dragon", "", "wyrm"],
        keySecondary: [" cave ", "cave", "hoard"],
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    expect(entry.key).toEqual(["dragon", "wyrm"]);
    expect(entry.keySecondary).toEqual(["cave", "hoard"]);
  });

  it("lets callers clear an entry body while preserving omitted optional blocks", () => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Defaulted Entry",
        body: "Entry body.",
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    const updated = updateLorebookEntryRecord(
      entry,
      {
        title: entry.title,
        body: "",
      },
      "2026-06-24T08:00:00.000Z",
    );

    expect(updated.body).toBe("");
    expect(updated.recursion).toBeNull();
    expect(updated.timing).toBeNull();
    expect(updated.triggers).toBeNull();
    expect(updated.characterFilter).toBeNull();
    expect(updated.matchSources).toBeNull();
  });

  it.each([
    { input: -1, expected: 0 },
    { input: 0, expected: 0 },
    { input: 50, expected: 50 },
    { input: 100, expected: 100 },
    { input: 101, expected: 100 },
    { input: Number.NaN, expected: 100 },
    { input: Number.POSITIVE_INFINITY, expected: 100 },
  ])("normalizes probability $input to $expected", ({ input, expected }) => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Defaulted Entry",
        probability: input,
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    expect(entry.probability).toBe(expected);
  });

  it("normalizes invalid entry tuning numbers when creating entries", () => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Defaulted Entry",
        probability: Number.POSITIVE_INFINITY,
        groupWeight: Number.NaN,
        prioritizeInclusion: true,
        insertionOrder: Number.NaN,
        depth: -1,
        recursion: {
          nonRecursable: true,
          preventFurther: false,
          delayUntilRecursion: true,
          recursionLevel: -3,
        },
        timing: {
          sticky: -1,
          cooldown: Number.NaN,
          delay: 3,
        },
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    expect(entry).toMatchObject({
      probability: 100,
      groupWeight: 100,
      prioritizeInclusion: true,
      insertionOrder: 100,
      depth: null,
      recursion: {
        nonRecursable: true,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 0,
      },
      timing: {
        sticky: 0,
        cooldown: 0,
        delay: 3,
      },
    });
  });

  it("preserves valid entry tuning values when update patches are invalid", () => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Defaulted Entry",
        probability: 25,
        groupWeight: 75,
        prioritizeInclusion: true,
        insertionOrder: 50,
        depth: 2,
        recursion: {
          nonRecursable: false,
          preventFurther: true,
          delayUntilRecursion: false,
          recursionLevel: 4,
        },
        timing: {
          sticky: 1,
          cooldown: 2,
          delay: 3,
        },
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    const updated = updateLorebookEntryRecord(
      entry,
      {
        title: entry.title,
        probability: Number.NaN,
        groupWeight: Number.NEGATIVE_INFINITY,
        prioritizeInclusion: false,
        insertionOrder: Number.POSITIVE_INFINITY,
        depth: -1,
        recursion: {
          nonRecursable: true,
          preventFurther: false,
          delayUntilRecursion: true,
          recursionLevel: Number.NEGATIVE_INFINITY,
        },
        timing: {
          sticky: Number.NaN,
          cooldown: -1,
          delay: Number.POSITIVE_INFINITY,
        },
      },
      "2026-06-24T08:00:00.000Z",
    );

    expect(updated).toMatchObject({
      probability: 25,
      groupWeight: 75,
      prioritizeInclusion: false,
      insertionOrder: 50,
      depth: 2,
      recursion: {
        nonRecursable: true,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 4,
      },
      timing: {
        sticky: 1,
        cooldown: 2,
        delay: 3,
      },
    });
  });
});
