import { describe, expect, it, vi } from "vitest";

import type { PromptPresetRelationshipTransactionResult } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import { deletePromptPresetAndNavigate } from "./prompt-presets-navigation";

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
