import { describe, expect, it, vi } from "vitest";

import type { PromptPresetRelationshipTransactionResult } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import type { PromptPresetCatalogTransactionResult } from "../../navigation";
import {
  deletePromptPresetAndNavigate,
  restoreStarterPromptPresetAndNavigate,
} from "./prompt-presets-navigation";

function result(
  overrides: Partial<PromptPresetRelationshipTransactionResult> = {},
): PromptPresetRelationshipTransactionResult {
  return {
    saved: false,
    published: false,
    blocked: false,
    message: "Prompt preset deletion failed.",
    ...overrides,
  };
}

function catalogResult(
  overrides: Partial<PromptPresetCatalogTransactionResult> = {},
): PromptPresetCatalogTransactionResult {
  return {
    saved: false,
    published: false,
    blocked: false,
    message: "Starter preset restore failed.",
    ...overrides,
  };
}

describe("deletePromptPresetAndNavigate", () => {
  it("navigates only after a published deletion", async () => {
    const deletePromptPreset = vi.fn(async () =>
      result({ saved: true, published: true, message: "Prompt preset change saved." }),
    );
    const setPromptPresetFileStatus = vi.fn();
    const setView = vi.fn();

    await deletePromptPresetAndNavigate({
      presetId: "preset-1",
      deletePromptPreset,
      setPromptPresetFileStatus,
      setView,
    });

    expect(deletePromptPreset).toHaveBeenCalledWith("preset-1");
    expect(setView).toHaveBeenCalledWith({ kind: "presets" });
    expect(setPromptPresetFileStatus).toHaveBeenCalledWith("");
  });

  it.each([
    result({ blocked: true, message: "Another storage transaction is active." }),
    result({ message: "The default prompt preset cannot be deleted." }),
  ])("keeps the editor open and surfaces a non-published result", async (transactionResult) => {
    const deletePromptPreset = vi.fn(async () => transactionResult);
    const setPromptPresetFileStatus = vi.fn();
    const setView = vi.fn();

    await deletePromptPresetAndNavigate({
      presetId: "preset-1",
      deletePromptPreset,
      setPromptPresetFileStatus,
      setView,
    });

    expect(setView).not.toHaveBeenCalled();
    expect(setPromptPresetFileStatus).toHaveBeenLastCalledWith(transactionResult.message);
  });
});

describe("restoreStarterPromptPresetAndNavigate", () => {
  it("navigates to a published restored preset", async () => {
    const restoreStarterPromptPreset = vi.fn(async () =>
      catalogResult({
        saved: true,
        published: true,
        preset: { ...STARTER_PROMPT_PRESET, id: "fresh" },
      }),
    );
    const onRestoredPresetReady = vi.fn();
    const setError = vi.fn();

    await restoreStarterPromptPresetAndNavigate({
      restoreStarterPromptPreset,
      onRestoredPresetReady,
      setError,
      isOriginCurrent: () => true,
    });

    expect(onRestoredPresetReady).toHaveBeenCalledWith("fresh");
    expect(setError).not.toHaveBeenCalled();
  });

  it("surfaces failure without navigating", async () => {
    const transaction = catalogResult({ message: "restore failed" });
    const onRestoredPresetReady = vi.fn();
    const setError = vi.fn();

    await restoreStarterPromptPresetAndNavigate({
      restoreStarterPromptPreset: vi.fn(async () => transaction),
      onRestoredPresetReady,
      setError,
      isOriginCurrent: () => true,
    });

    expect(onRestoredPresetReady).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith("restore failed");
  });

  it("does not hijack a stale origin after a published result", async () => {
    const onRestoredPresetReady = vi.fn();
    const setError = vi.fn();

    await restoreStarterPromptPresetAndNavigate({
      restoreStarterPromptPreset: vi.fn(async () =>
        catalogResult({
          saved: true,
          published: true,
          preset: { ...STARTER_PROMPT_PRESET, id: "fresh" },
        }),
      ),
      onRestoredPresetReady,
      setError,
      isOriginCurrent: () => false,
    });

    expect(onRestoredPresetReady).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("does not surface a failed restore after its origin is stale", async () => {
    const onRestoredPresetReady = vi.fn();
    const setError = vi.fn();

    await restoreStarterPromptPresetAndNavigate({
      restoreStarterPromptPreset: vi.fn(async () =>
        catalogResult({ message: "late restore failure" }),
      ),
      onRestoredPresetReady,
      setError,
      isOriginCurrent: () => false,
    });

    expect(onRestoredPresetReady).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });
});
