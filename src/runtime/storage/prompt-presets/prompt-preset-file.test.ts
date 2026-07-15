import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { createPromptPresetFileExport, parsePromptPresetFileText } from "./prompt-preset-file";

const now = "2026-07-11T00:00:00.000Z";

function promptPreset(): PromptPresetRecord {
  return {
    id: "prompt-preset-file-proof",
    schemaVersion: 1,
    title: "Portable: Preset / Proof",
    summary: "Standalone package proof.",
    systemPrompt: "Write the next response.",
    messengerPrompt: null,
    parameters: {
      temperature: { send: true, value: 0.7 },
      maxTokens: { send: true, value: 1024 },
    },
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    wrapFormat: null,
    author: null,
    folderId: null,
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("standalone prompt preset files", () => {
  it("creates a portable export with a safe title-based .json filename", () => {
    const result = createPromptPresetFileExport(promptPreset(), now);

    expect(result.filename).toBe("Portable- Preset - Proof.json");
    expect(result.packageValue).toMatchObject({
      type: "dekoi_preset",
      version: 1,
      exportedAt: now,
      data: { preset: { name: "Portable: Preset / Proof" } },
    });
  });

  it("prefixes Windows reserved device names in export filenames", () => {
    const preset = promptPreset();

    expect(createPromptPresetFileExport({ ...preset, title: "CON" }, now).filename).toBe(
      "prompt-preset-CON.json",
    );
    expect(createPromptPresetFileExport({ ...preset, title: "lpt1.txt" }, now).filename).toBe(
      "prompt-preset-lpt1.txt.json",
    );
  });

  it("parses the exported package back into a native preset", () => {
    const preset = promptPreset();
    const exported = createPromptPresetFileExport(preset, now);

    expect(parsePromptPresetFileText(JSON.stringify(exported.packageValue))).toEqual({
      ok: true,
      preset,
    });
  });

  it("reports invalid JSON separately from unsupported or invalid package content", () => {
    expect(parsePromptPresetFileText("{not-json")).toEqual({
      ok: false,
      error: "Prompt preset file must be valid JSON.",
    });
    expect(parsePromptPresetFileText(JSON.stringify({ type: "dekoi_bundle", version: 1 }))).toEqual(
      {
        ok: false,
        error: "File is not a supported, valid prompt preset package.",
      },
    );
    expect(parsePromptPresetFileText("null")).toEqual({
      ok: false,
      error: "File is not a supported, valid prompt preset package.",
    });
  });

  it("rejects raw native records and hybrids with an unsupported package version", () => {
    const nativeRecord = promptPreset();

    expect(parsePromptPresetFileText(JSON.stringify(nativeRecord))).toEqual({
      ok: false,
      error: "File is not a supported, valid prompt preset package.",
    });
    expect(
      parsePromptPresetFileText(
        JSON.stringify({
          ...nativeRecord,
          type: "dekoi_preset",
          version: 2,
        }),
      ),
    ).toEqual({
      ok: false,
      error: "File is not a supported, valid prompt preset package.",
    });
  });

  it("rejects malformed required row collections as a validation failure", () => {
    const exported = createPromptPresetFileExport(promptPreset(), now).packageValue;

    expect(
      parsePromptPresetFileText(
        JSON.stringify({
          ...exported,
          data: { ...exported.data, sections: "corrupt" },
        }),
      ),
    ).toEqual({
      ok: false,
      error: "File is not a supported, valid prompt preset package.",
    });
  });
});
