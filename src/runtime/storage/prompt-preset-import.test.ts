import { describe, expect, it } from "vitest";

import { normalizePromptPresetImportRecord } from "./prompt-preset-import";

const now = "2026-07-08T00:00:00.000Z";

describe("normalizePromptPresetImportRecord", () => {
  it("prefers the packaged preset id over the envelope id", () => {
    const record = normalizePromptPresetImportRecord({
      id: "package-export-id",
      type: "dekoi_preset",
      version: 1,
      exportedAt: now,
      data: {
        preset: {
          id: "preset-native-id",
          name: "Standard Preset",
          systemPrompt: "Write the next response.",
          createdAt: now,
          updatedAt: now,
        },
        sections: [
          {
            id: "section-system",
            presetId: "preset-native-id",
            identifier: "system",
            name: "System",
            content: "Write clearly.",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [
          {
            id: "group-core",
            presetId: "preset-native-id",
            name: "Core",
          },
        ],
        choiceBlocks: [
          {
            id: "choice-tone",
            presetId: "preset-native-id",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
        ],
      },
    });

    expect(record?.id).toBe("preset-native-id");
    expect(record?.sections[0]?.presetId).toBe("preset-native-id");
    expect(record?.groups[0]?.presetId).toBe("preset-native-id");
    expect(record?.choiceBlocks[0]?.presetId).toBe("preset-native-id");
  });
});
