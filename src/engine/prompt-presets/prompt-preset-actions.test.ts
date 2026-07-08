import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizePromptPresetRecord } from "./prompt-preset-actions";

const now = "2026-07-08T00:00:00.000Z";

describe("normalizePromptPresetRecord", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back when prompt preset timestamps are malformed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write the next response.",
      createdAt: "not-a-date",
      updatedAt: "also-not-a-date",
    });

    expect(record?.createdAt).toBe(now);
    expect(record?.updatedAt).toBe(now);
  });
});
