import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_PROMPT_PRESET_DRAFT } from "./prompt-preset-draft";
import { PromptPresetChoiceEditor } from "./PromptPresetChoiceEditor";

describe("PromptPresetChoiceEditor", () => {
  it("keeps option field IDs unique across choice blocks", () => {
    const markup = renderToStaticMarkup(
      <PromptPresetChoiceEditor
        draft={{
          ...EMPTY_PROMPT_PRESET_DRAFT,
          choiceBlocks: [
            {
              id: "a-b",
              variableName: "first",
              label: "First",
              options: [{ id: "c", label: "Yes", value: "yes" }],
            },
            {
              id: "a",
              variableName: "second",
              label: "Second",
              options: [{ id: "b-c", label: "Yes", value: "yes" }],
            },
          ],
        }}
        onDraftChange={vi.fn()}
      />,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const labelledIds = [...markup.matchAll(/\sfor="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
    expect(labelledIds.every((id) => ids.includes(id))).toBe(true);
  });

  it("renders visibility controls from the stable controller ID", () => {
    const markup = renderToStaticMarkup(
      <PromptPresetChoiceEditor
        draft={{
          ...EMPTY_PROMPT_PRESET_DRAFT,
          choiceBlocks: [
            {
              id: "choice-beta",
              variableName: "beta",
              label: "Beta",
              options: [{ id: "beta-on", label: "Beta On", value: "beta-on" }],
            },
            {
              id: "choice-alpha",
              variableName: "beta",
              label: "Alpha",
              options: [{ id: "alpha-on", label: "Alpha On", value: "alpha-on" }],
            },
            {
              id: "choice-dependent",
              variableName: "dependent",
              label: "Dependent",
              options: [{ id: "dependent-on", label: "On", value: "on" }],
              visibilityRule: { variableName: "beta", values: ["alpha-on"] },
            },
          ],
          visibilityControllerIdsByBlockId: { "choice-dependent": "choice-alpha" },
        }}
        onDraftChange={vi.fn()}
      />,
    );

    expect(markup).toContain('<option value="choice-alpha" selected="">Alpha</option>');
    expect(markup).toContain("<span>Alpha On</span>");
  });
});
