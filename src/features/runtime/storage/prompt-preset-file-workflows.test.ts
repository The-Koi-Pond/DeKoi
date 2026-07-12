import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { downloadJsonFile } from "../../../shared/browser/download-json";
import {
  exportDesktopPromptPresetFile,
  importDesktopPromptPresetFile,
} from "../../../shared/api/desktop-prompt-preset-file";
import {
  downloadPromptPresetBrowserFile,
  readPromptPresetBrowserFile,
  readPromptPresetDesktopFile,
  writePromptPresetDesktopFile,
} from "./prompt-preset-file-workflows";

vi.mock("../../../shared/browser/download-json", () => ({
  downloadJsonFile: vi.fn(),
}));

vi.mock("../../../shared/api/desktop-prompt-preset-file", () => ({
  exportDesktopPromptPresetFile: vi.fn(),
  importDesktopPromptPresetFile: vi.fn(),
}));

const now = "2026-07-11T00:00:00.000Z";

function promptPreset(): PromptPresetRecord {
  return {
    id: "preset-portable",
    schemaVersion: 1,
    title: "Portable Preset",
    summary: null,
    systemPrompt: "Write the next response.",
    messengerPrompt: null,
    sampling: { temperature: 0.7 },
    parameters: { temperature: 0.7 },
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    wrapFormat: null,
    isDefault: false,
    author: null,
    folderId: null,
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

function compatiblePackage() {
  return {
    type: "dekoi_preset",
    version: 1,
    exportedAt: now,
    data: {
      preset: {
        id: "preset-portable",
        name: "Portable Preset",
        systemPrompt: "Write the next response.",
        parameters: { temperature: 0.7 },
        createdAt: now,
        updatedAt: now,
      },
      sections: [],
      groups: [],
      choiceBlocks: [],
    },
  };
}

describe("prompt preset file workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["Portable Preset.json", "Portable Preset.marinara.json"])(
    "imports %s by content instead of filename suffix",
    async (name) => {
      const result = await readPromptPresetBrowserFile({
        name,
        text: async () => JSON.stringify(compatiblePackage()),
      });

      expect(result).toMatchObject({
        ok: true,
        sourceName: name,
        preset: { id: "preset-portable", title: "Portable Preset" },
      });
    },
  );

  it("reports browser file read failures without attempting package parsing", async () => {
    const result = await readPromptPresetBrowserFile({
      name: "Unreadable.json",
      text: async () => {
        throw new Error("permission denied");
      },
    });

    expect(result).toEqual({
      ok: false,
      error: "Could not read prompt preset file. permission denied",
    });
  });

  it("downloads the stable package with the title-based filename", () => {
    const result = downloadPromptPresetBrowserFile(promptPreset(), now);

    expect(result).toEqual({ ok: true, filename: "Portable Preset.json", path: null });
    expect(downloadJsonFile).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "dekoi_preset", version: 1 }),
      filename: "Portable Preset.json",
    });
  });

  it("uses the focused desktop wrapper for save and open", async () => {
    vi.mocked(exportDesktopPromptPresetFile).mockResolvedValue("C:\\Presets\\Portable Preset.json");
    vi.mocked(importDesktopPromptPresetFile).mockResolvedValue(JSON.stringify(compatiblePackage()));

    await expect(writePromptPresetDesktopFile(promptPreset(), now)).resolves.toEqual({
      ok: true,
      filename: "Portable Preset.json",
      path: "C:\\Presets\\Portable Preset.json",
    });
    await expect(readPromptPresetDesktopFile()).resolves.toMatchObject({
      ok: true,
      sourceName: null,
      preset: { id: "preset-portable", title: "Portable Preset" },
    });
    expect(exportDesktopPromptPresetFile).toHaveBeenCalledWith(
      expect.objectContaining({ type: "dekoi_preset", version: 1 }),
      "Portable Preset.json",
    );
    expect(importDesktopPromptPresetFile).toHaveBeenCalledOnce();
  });

  it("runs desktop text through the same plain JSON parser as browser files", async () => {
    vi.mocked(importDesktopPromptPresetFile).mockResolvedValue("{not-json");

    await expect(readPromptPresetDesktopFile()).resolves.toEqual({
      ok: false,
      error: "Prompt preset file must be valid JSON.",
    });
  });

  it("keeps desktop cancellation distinct from file and validation failures", async () => {
    vi.mocked(importDesktopPromptPresetFile).mockResolvedValue(null);

    await expect(readPromptPresetDesktopFile()).resolves.toEqual({
      ok: false,
      cancelled: true,
      error: "Prompt preset file import was cancelled.",
    });
  });
});
