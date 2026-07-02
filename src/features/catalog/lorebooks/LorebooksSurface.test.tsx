import { describe, expect, it } from "vitest";

import {
  canSaveLorebookEntryDraft,
  lorebookEntryDraftToInput,
  parseLorebookEntryKeys,
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
});
