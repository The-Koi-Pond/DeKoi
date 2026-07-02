import { describe, expect, it } from "vitest";

import {
  canSaveLorebookEntryDraft,
  entryDraftDisablesBannerSave,
  lorebookEntryDraftToInput,
  parseLorebookEntryKeys,
  readNullableNonNegativeIntegerInput,
  readNullablePercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";
import { readScanDepthInput } from "./lorebook-scan-depth";

describe("readScanDepthInput", () => {
  it("treats blank scan-depth drafts as invalid", () => {
    expect(readScanDepthInput("", 2)).toBe(2);
    expect(readScanDepthInput("   ", 3)).toBe(3);
  });

  it("normalizes finite non-negative integer scan depths", () => {
    expect(readScanDepthInput("4.9", 2)).toBe(4);
    expect(readScanDepthInput("-1", 2)).toBe(0);
    expect(readScanDepthInput("Infinity", 2)).toBe(2);
  });
});

const baseDraft: LorebookEntryDraft = {
  title: "Entry",
  body: "Body",
  enabled: true,
  strategy: "constant",
  key: "",
  keySecondary: "",
  selectiveLogic: "and-any",
  insertionOrder: "100",
  insertionPosition: "after-character",
  depth: "0",
  role: "system",
};

describe("lorebook entry draft helpers", () => {
  it("rejects selective drafts without parsed keys", () => {
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: "",
      }),
    ).toBe(false);
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: " , , ",
      }),
    ).toBe(false);
  });

  it("allows constants without keys and selective drafts with parsed keys", () => {
    expect(canSaveLorebookEntryDraft(baseDraft)).toBe(true);
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: "canal",
      }),
    ).toBe(true);
  });

  it("parses comma-separated keys before persistence", () => {
    expect(parseLorebookEntryKeys(" canal,  tower ,, ")).toEqual([
      "canal",
      "tower",
    ]);
    expect(parseLorebookEntryKeys(" /wolf{2,3}/i, canal ")).toEqual([
      "/wolf{2,3}/i",
      "canal",
    ]);
    expect(parseLorebookEntryKeys(" /amber,bell/, tower ")).toEqual([
      "/amber,bell/",
      "tower",
    ]);
    expect(parseLorebookEntryKeys(" /route, canal ")).toEqual([
      "/route",
      "canal",
    ]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf/ ")).toEqual([
      "/route",
      "canal",
      "/wolf/",
    ]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf ")).toEqual([
      "/route",
      "canal",
      "/wolf",
    ]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf/q ")).toEqual([
      "/route",
      "canal",
      "/wolf/q",
    ]);
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        strategy: "selective",
        key: "canal",
      }),
    ).toMatchObject({
      strategy: "selective",
      key: ["canal"],
    });
  });

  it("serializes optional filters and clears stale selective logic", () => {
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        keySecondary: "amber,  violet ,, ",
        selectiveLogic: "and-all",
      }),
    ).toMatchObject({
      keySecondary: ["amber", "violet"],
      selectiveLogic: "and-all",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        keySecondary: " , , ",
        selectiveLogic: "not-any",
      }),
    ).toMatchObject({
      keySecondary: null,
      selectiveLogic: null,
    });
  });

  it("serializes insertion order, position, depth, and role", () => {
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionPosition: "at-depth",
      }),
    ).toMatchObject({
      insertionPosition: "at-depth",
      role: "system",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionOrder: "25.5",
        insertionPosition: "at-depth",
        depth: "2.9",
        role: "assistant",
      }),
    ).toMatchObject({
      insertionOrder: 25.5,
      insertionPosition: "at-depth",
      depth: 2,
      role: "assistant",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionPosition: "before-character",
        depth: "4",
        role: "user",
      }),
    ).toMatchObject({
      insertionPosition: "before-character",
      depth: null,
      role: null,
    });
  });

  it("normalizes nullable budget inputs", () => {
    expect(readNullableNonNegativeIntegerInput("", 7)).toBeNull();
    expect(readNullableNonNegativeIntegerInput("3.9", null)).toBe(3);
    expect(readNullableNonNegativeIntegerInput("nope", 7)).toBe(7);
    expect(readNullablePercentInput("150", null)).toBe(100);
  });

  it("applies entry draft save blocking only when the entry editor owns save", () => {
    const invalidSelectiveDraft: LorebookEntryDraft = {
      ...baseDraft,
      strategy: "selective",
      key: "",
    };

    expect(
      entryDraftDisablesBannerSave({
        draft: invalidSelectiveDraft,
        showEditor: true,
        showLorebookEditor: false,
      }),
    ).toBe(true);
    expect(
      entryDraftDisablesBannerSave({
        draft: invalidSelectiveDraft,
        showEditor: true,
        showLorebookEditor: true,
      }),
    ).toBe(false);
  });
});
