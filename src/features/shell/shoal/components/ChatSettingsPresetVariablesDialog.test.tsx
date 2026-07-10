import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import { reconcileSelectedOptionIds } from "../lib/preset-choice-selection-order";
import { ChatSettingsPresetVariablesDialog } from "./ChatSettingsPresetVariablesDialog";

const now = "2026-07-10T00:00:00.000Z";

function promptPreset(choiceBlock: PromptPresetRecord["choiceBlocks"][number]): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Choice Preset",
    systemPrompt: "Use the selected choices.",
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [choiceBlock.id],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [choiceBlock],
    createdAt: now,
    updatedAt: now,
  };
}

function renderDialog(preset: PromptPresetRecord) {
  return renderToStaticMarkup(
    <ChatSettingsPresetVariablesDialog
      open
      preset={preset}
      presetChoiceSelections={{}}
      onClose={vi.fn()}
      onPresetChoiceChange={vi.fn()}
    />,
  );
}

describe("ChatSettingsPresetVariablesDialog", () => {
  it("preserves existing multi-select order and appends newly selected options", () => {
    expect(reconcileSelectedOptionIds(["zebra", "alpha"], ["alpha", "new", "zebra"])).toEqual([
      "zebra",
      "alpha",
      "new",
    ]);
    expect(reconcileSelectedOptionIds(["zebra", "alpha"], ["alpha"])).toEqual(["alpha"]);
  });

  it("renders button presentation in the projected alphabetical order", () => {
    const markup = renderDialog(
      promptPreset({
        id: "choice-tone",
        variableName: "tone",
        label: "Tone",
        displayMode: "buttons",
        optionSort: "alphabetical",
        options: [
          { id: "zebra", label: "Zebra", value: "zebra" },
          { id: "alpha", label: "alpha", value: "alpha" },
        ],
      }),
    );

    expect(markup).toContain('class="preset-variables-button-list"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup.indexOf(">alpha</button>")).toBeLessThan(markup.indexOf(">Zebra</button>"));
  });

  it("renders multi-select listbox presentation", () => {
    const markup = renderDialog(
      promptPreset({
        id: "choice-tags",
        variableName: "tags",
        label: "Tags",
        displayMode: "listbox",
        multiSelect: true,
        options: [
          { id: "vivid", label: "Vivid", value: "vivid" },
          { id: "concise", label: "Concise", value: "concise" },
        ],
      }),
    );

    expect(markup).toContain('class="pondinput preset-variables-listbox"');
    expect(markup).toContain(' multiple=""');
  });

  it("renders a single-select listbox request as a dropdown", () => {
    const markup = renderDialog(
      promptPreset({
        id: "choice-tone",
        variableName: "tone",
        label: "Tone",
        displayMode: "listbox",
        options: [
          { id: "warm", label: "Warm", value: "warm" },
          { id: "dry", label: "Dry", value: "dry" },
        ],
      }),
    );

    expect(markup).not.toContain("preset-variables-listbox");
    expect(markup).not.toContain(' multiple=""');
  });
});
