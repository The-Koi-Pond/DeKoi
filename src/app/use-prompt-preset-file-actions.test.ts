import { describe, expect, it, vi } from "vitest";

import type { NavCatalogState } from "../features/navigation";
import { commitPromptPresetFileImport } from "./use-prompt-preset-file-actions";

const now = "2026-07-11T00:00:00.000Z";
type PromptPresetRecord = NavCatalogState["promptPresets"][number];

function promptPreset(id = "preset-source"): PromptPresetRecord {
  return {
    id,
    schemaVersion: 1,
    title: "Portable Preset",
    summary: null,
    systemPrompt: "Write the next response.",
    messengerPrompt: null,
    sampling: null,
    parameters: null,
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

function flushResult({
  mode = "desktop",
  status = "ready",
  flushed = true,
  savedCollectionKeys = [],
  failedCollectionKeys = [],
  message = "Storage saves flushed for import.",
  blocked = false,
}: {
  mode?: "desktop" | "remote" | "unavailable";
  status?: "ready" | "error";
  flushed?: boolean;
  savedCollectionKeys?: string[];
  failedCollectionKeys?: string[];
  message?: string;
  blocked?: boolean;
} = {}) {
  return {
    mode,
    status,
    message,
    flushed,
    blocked,
    dirtyCollectionKeys: [] as string[],
    savedCollectionKeys,
    failedCollectionKeys,
  };
}

function presetSaveResult({
  status = "ready",
  saved = true,
  message = "Prompt preset saved.",
  blocked = false,
}: {
  status?: "ready" | "error";
  saved?: boolean;
  message?: string;
  blocked?: boolean;
} = {}) {
  return {
    mode: "desktop" as const,
    status,
    message,
    saved,
    blocked,
  };
}

function deferred<Result>() {
  let resolve!: (result: Result) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Result>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function selectPresetIfAvailable(
  state: {
    promptPresets: PromptPresetRecord[];
    messengerPresetIds: string[];
    roleplayPresetIds: string[];
  },
  presetId: string,
) {
  if (!state.promptPresets.some((preset) => preset.id === presetId)) return;
  state.messengerPresetIds = [presetId];
  state.roleplayPresetIds = [presetId];
}

describe("commitPromptPresetFileImport", () => {
  it("does not touch storage or catalog state when parsing failed", async () => {
    const prepareImportedPromptPreset = vi.fn();
    const addImportedPromptPreset = vi.fn();
    const savePromptPresetImport = vi.fn();
    const flushAppStorageSaves = vi.fn();

    await expect(
      commitPromptPresetFileImport({
        result: { ok: false, error: "Invalid package." },
        prepareImportedPromptPreset,
        addImportedPromptPreset,
        savePromptPresetImport,
        flushAppStorageSaves,
        applyStateChange: (change) => change(),
      }),
    ).resolves.toEqual({ ok: false, error: "Invalid package." });
    expect(prepareImportedPromptPreset).not.toHaveBeenCalled();
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
    expect(savePromptPresetImport).not.toHaveBeenCalled();
    expect(flushAppStorageSaves).not.toHaveBeenCalled();
  });

  it("does not add the preset when existing changes cannot be flushed", async () => {
    const addImportedPromptPreset = vi.fn();
    const prepareImportedPromptPreset = vi.fn();
    const flushAppStorageSaves = vi.fn().mockResolvedValue(
      flushResult({
        status: "error",
        flushed: false,
        failedCollectionKeys: ["characters"],
        message: "Existing save failed.",
      }),
    );

    const result = await commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset,
      addImportedPromptPreset,
      savePromptPresetImport: vi.fn(),
      flushAppStorageSaves,
      applyStateChange: (change) => change(),
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Import was not started because current changes could not be saved. Existing save failed.",
    });
    expect(prepareImportedPromptPreset).not.toHaveBeenCalled();
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
  });

  it("adds a session-only preset with a plain warning when storage is unavailable", async () => {
    const importedPreset = promptPreset("prompt-preset-session");
    const prepareImportedPromptPreset = vi.fn(() => importedPreset);
    const addImportedPromptPreset = vi.fn(() => importedPreset);
    const savePromptPresetImport = vi.fn();
    const flushAppStorageSaves = vi.fn().mockResolvedValue(
      flushResult({
        mode: "unavailable",
        status: "error",
        flushed: false,
        message: "No storage target is configured.",
      }),
    );

    const result = await commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset,
      addImportedPromptPreset,
      savePromptPresetImport,
      flushAppStorageSaves,
      applyStateChange: (change) => change(),
    });

    expect(result).toEqual({
      ok: true,
      preset: importedPreset,
      sourceName: "Preset.json",
      storageWarning: "Storage is unavailable; this imported preset exists only for this session.",
    });
    expect(prepareImportedPromptPreset).toHaveBeenCalledWith(promptPreset());
    expect(flushAppStorageSaves).toHaveBeenCalledTimes(1);
    expect(savePromptPresetImport).not.toHaveBeenCalled();
  });

  it("does not mutate catalog state while unavailable storage is still initializing", async () => {
    const addImportedPromptPreset = vi.fn();
    const prepareImportedPromptPreset = vi.fn();
    const flushAppStorageSaves = vi.fn().mockResolvedValue(
      flushResult({
        mode: "unavailable",
        status: "error",
        flushed: false,
        blocked: true,
        message: "Storage is not ready yet.",
      }),
    );

    const result = await commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset,
      addImportedPromptPreset,
      savePromptPresetImport: vi.fn(),
      flushAppStorageSaves,
      applyStateChange: (change) => change(),
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Import was not started because current changes could not be saved. Storage is not ready yet.",
    });
    expect(prepareImportedPromptPreset).not.toHaveBeenCalled();
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
  });

  it("keeps a staged preset unavailable during a slow save, then publishes it", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const importedPreset = promptPreset("prompt-preset-fresh");
    const state = {
      promptPresets: [existingPreset],
      messengerPresetIds: [existingPreset.id],
      roleplayPresetIds: [existingPreset.id],
    };
    const initialState = structuredClone(state);
    const save = deferred<ReturnType<typeof presetSaveResult>>();
    const saveStarted = deferred<void>();
    const addImportedPromptPreset = vi.fn((preset: PromptPresetRecord) => {
      state.promptPresets.unshift(preset);
      return preset;
    });
    const savePromptPresetImport = vi.fn(() => {
      saveStarted.resolve();
      return save.promise;
    });
    const pendingResult = commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset: vi.fn(() => importedPreset),
      addImportedPromptPreset,
      savePromptPresetImport,
      flushAppStorageSaves: vi.fn().mockResolvedValue(flushResult()),
      applyStateChange: (change) => change(),
    });

    await saveStarted.promise;
    selectPresetIfAvailable(state, importedPreset.id);
    expect(state).toEqual(initialState);
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
    expect(savePromptPresetImport).toHaveBeenCalledWith(importedPreset);

    save.resolve(presetSaveResult());
    const result = await pendingResult;

    expect(result).toEqual({
      ok: true,
      preset: importedPreset,
      sourceName: "Preset.json",
    });
    expect(state).toEqual({
      ...initialState,
      promptPresets: [importedPreset, existingPreset],
    });
  });

  it("leaves catalog and mode references unchanged when the staged save fails", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const importedPreset = promptPreset("prompt-preset-fresh");
    const state = {
      promptPresets: [existingPreset],
      messengerPresetIds: [existingPreset.id],
      roleplayPresetIds: [existingPreset.id],
    };
    const initialState = structuredClone(state);
    const save = deferred<ReturnType<typeof presetSaveResult>>();
    const saveStarted = deferred<void>();
    const addImportedPromptPreset = vi.fn((preset: PromptPresetRecord) => {
      state.promptPresets.unshift(preset);
      return preset;
    });
    const savePromptPresetImport = vi.fn(() => {
      saveStarted.resolve();
      return save.promise;
    });

    const pendingResult = commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset: vi.fn(() => importedPreset),
      addImportedPromptPreset,
      savePromptPresetImport,
      flushAppStorageSaves: vi.fn().mockResolvedValue(flushResult()),
      applyStateChange: (change) => change(),
    });

    await saveStarted.promise;
    selectPresetIfAvailable(state, importedPreset.id);
    expect(state).toEqual(initialState);
    expect(savePromptPresetImport).toHaveBeenCalledWith(importedPreset);

    save.resolve(
      presetSaveResult({ status: "error", saved: false, message: "Prompt preset save failed." }),
    );
    const result = await pendingResult;
    selectPresetIfAvailable(state, importedPreset.id);

    expect(result).toEqual({
      ok: false,
      error: "Import failed while saving the new prompt preset. Prompt preset save failed.",
    });
    expect(state).toEqual(initialState);
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
  });

  it("reduces thrown staged-save failures to a plain outcome without publishing", async () => {
    const importedPreset = promptPreset("prompt-preset-fresh");
    const addImportedPromptPreset = vi.fn(() => importedPreset);

    const result = await commitPromptPresetFileImport({
      result: { ok: true, preset: promptPreset(), sourceName: "Preset.json" },
      prepareImportedPromptPreset: vi.fn(() => importedPreset),
      addImportedPromptPreset,
      savePromptPresetImport: vi.fn().mockRejectedValue(new Error("storage transport failed")),
      flushAppStorageSaves: vi.fn().mockResolvedValue(flushResult()),
      applyStateChange: (change) => change(),
    });

    expect(result).toEqual({
      ok: false,
      error: "Import failed while saving the new prompt preset. storage transport failed",
    });
    expect(addImportedPromptPreset).not.toHaveBeenCalled();
  });
});
