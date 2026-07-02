import { describe, expect, it } from "vitest";

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
