import { describe, expect, it } from "vitest";

import { normalizePromptPresetRecord } from "./prompt-preset-actions";
import { assemblePromptPresetMessages } from "./prompt-preset-assembler";
import { STARTER_PROMPT_PRESET } from "./starter-preset";

describe("Universal V2 starter prompt preset", () => {
  it("normalizes every ordered row and choice reference into a native record", () => {
    expect(STARTER_PROMPT_PRESET.sections).toHaveLength(14);
    expect(STARTER_PROMPT_PRESET.groups).toHaveLength(1);
    expect(STARTER_PROMPT_PRESET.choiceBlocks).toHaveLength(11);

    const sectionIds = new Set(STARTER_PROMPT_PRESET.sections.map(({ id }) => id));
    const groupIds = new Set(STARTER_PROMPT_PRESET.groups.map(({ id }) => id));
    const choiceBlocksByVariable = new Map(
      STARTER_PROMPT_PRESET.choiceBlocks.map((block) => [block.variableName, block]),
    );
    const choiceBlockIds = new Set(STARTER_PROMPT_PRESET.choiceBlocks.map(({ id }) => id));

    expect(STARTER_PROMPT_PRESET.sectionOrder.every((id) => sectionIds.has(id))).toBe(true);
    expect(STARTER_PROMPT_PRESET.groupOrder.every((id) => groupIds.has(id))).toBe(true);
    expect(STARTER_PROMPT_PRESET.variableOrder.every((id) => choiceBlockIds.has(id))).toBe(true);

    for (const [variable, selection] of Object.entries(STARTER_PROMPT_PRESET.defaultChoices)) {
      const block = choiceBlocksByVariable.get(variable);
      expect(block).toBeDefined();
      const options = block?.options ?? [];
      const selections = Array.isArray(selection) ? selection : [selection];
      expect(
        selections.every((selected) =>
          typeof selected === "string"
            ? options.some(({ id, value }) => id === selected || value === selected)
            : options.some(({ id }) => id === selected.optionId),
        ),
      ).toBe(true);
    }

    expect(
      STARTER_PROMPT_PRESET.choiceBlocks.every((block) => !Object.hasOwn(block, "visibilityRule")),
    ).toBe(true);

    expect(normalizePromptPresetRecord(STARTER_PROMPT_PRESET)).toEqual(STARTER_PROMPT_PRESET);
  });

  it("assembles the normalized starter through the native prompt path", () => {
    const messages = assemblePromptPresetMessages({
      fallbackSystemPrompt: "Fallback prompt.",
      macroContext: { user: "User", char: "Companion", characters: ["Companion"], variables: {} },
      markerLines: () => [],
      preset: STARTER_PROMPT_PRESET,
      transcriptMessages: () => [{ role: "user", content: "Hello." }],
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some(({ content }) => content.trim().length > 0)).toBe(true);
  });
});
