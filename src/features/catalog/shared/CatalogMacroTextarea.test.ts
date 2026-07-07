import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createScratchMacroContext,
  resolveMacrosWithScratchContext,
  type MacroContext,
  type MacroVariableMutation,
} from "../../../engine/generation-core/macros/macro-engine";
import { CatalogMacroTextarea } from "./CatalogMacroTextarea";
import {
  createCharacterCatalogMacroPreviewContext,
  createPersonaCatalogMacroPreviewContext,
} from "./catalogMacroPreviewContext";
import { insertMacroText, resolveCatalogMacroPreview } from "./catalogMacroText";

describe("insertMacroText", () => {
  it("appends macros when no textarea selection has been captured", () => {
    expect(insertMacroText("Existing text", "{{char}}", null)).toEqual({
      nextCaret: "Existing text{{char}}".length,
      nextValue: "Existing text{{char}}",
    });
  });

  it("replaces the captured textarea selection", () => {
    expect(insertMacroText("Hello friend", "{{user}}", { start: 6, end: 12 })).toEqual({
      nextCaret: "Hello {{user}}".length,
      nextValue: "Hello {{user}}",
    });
  });

  it("clamps stale selection offsets to the current value", () => {
    expect(insertMacroText("Short", "{{model}}", { start: 50, end: 50 })).toEqual({
      nextCaret: "Short{{model}}".length,
      nextValue: "Short{{model}}",
    });
  });
});

describe("catalog macro live preview", () => {
  it("resolves previews through the engine scratch context", () => {
    const variableMutations: MacroVariableMutation[] = [];
    const context = createCharacterCatalogMacroPreviewContext({
      displayName: "Mara",
      nickname: "Mar",
      description: "Moon archivist",
      personality: "Dry and curious",
      scenario: "Testing the archive",
      firstMessage: "You're late.",
      exampleMessages: "Mara: Obviously.",
      systemPrompt: "Stay precise.",
      postHistoryInstructions: "Remember the canal.",
      creator: "Xel",
      characterVersion: "1",
      creatorNotes: "Private",
      characterNote: "Static note",
    });
    context.macroContext.variables.mood = "calm";
    context.macroContext.variableMutations = variableMutations;

    expect(
      resolveCatalogMacroPreview(
        "{{char}} {{getvar::mood}} {{setvar::mood::sharp}}{{getvar::mood}} {{random::A::B}} {{roll:2d6}}",
        context,
      ),
    ).toBe("Mara calm sharp A 2");
    expect(context.macroContext.variables).toEqual({ mood: "calm" });
    expect(variableMutations).toEqual([]);
  });

  it("keeps scratch macro context cloning in the engine layer", () => {
    const variableMutations: MacroVariableMutation[] = [];
    const context: MacroContext = {
      user: "Alex",
      char: "Mara",
      characters: ["Mara"],
      variables: { mood: "calm" },
      variableMutations,
    };
    const scratchContext = createScratchMacroContext(context);

    expect(resolveMacrosWithScratchContext("{{setvar::mood::sharp}}", context)).toBe("");
    expect(context.variables).toEqual({ mood: "calm" });
    expect(variableMutations).toEqual([]);
    expect(scratchContext).toMatchObject({
      user: "Alex",
      variables: { mood: "calm" },
    });
    expect(scratchContext).not.toBe(context);
    expect(scratchContext.variables).not.toBe(context.variables);
    expect(scratchContext.variableMutations).toBeUndefined();
  });

  it("builds companion and persona preview contexts from available draft fields", () => {
    const companionContext = createCharacterCatalogMacroPreviewContext({
      displayName: "Mara",
      nickname: null,
      description: "Moon archivist",
      personality: "",
      scenario: "",
      firstMessage: "",
      exampleMessages: "",
      systemPrompt: "",
      postHistoryInstructions: "",
      creator: "",
      characterVersion: "",
      creatorNotes: "",
      characterNote: "",
    });
    const personaContext = createPersonaCatalogMacroPreviewContext({ displayName: "Alex" });

    expect(
      resolveCatalogMacroPreview("{{char}}: {{description}} as {{user}}", companionContext),
    ).toBe("Mara: Moon archivist as the user");
    expect(
      resolveCatalogMacroPreview("{{persona}} sees {{char}} and {{displayName}}", personaContext),
    ).toBe("Alex sees the selected companion and ");
    expect(personaContext.macroContext.characterFields).toBeNull();
  });

  it("does not invent a persona display name when the persona draft name is blank", () => {
    const personaContext = createPersonaCatalogMacroPreviewContext({ displayName: "   " });

    expect(resolveCatalogMacroPreview("{{user}} / {{persona}}", personaContext)).toBe(
      "the user / {{persona}}",
    );
    expect(personaContext.macroContext.personaFields).toBeNull();
  });

  it("preserves blank persona macros inside nested preview macros", () => {
    const personaContext = createPersonaCatalogMacroPreviewContext({ displayName: "   " });

    expect(resolveCatalogMacroPreview("{{random::{{persona}}::x}}", personaContext)).toBe(
      "{{persona}}",
    );
  });

  it("preserves blank persona macros through preview format macros", () => {
    const personaContext = createPersonaCatalogMacroPreviewContext({ displayName: "   " });

    expect(
      resolveCatalogMacroPreview("{{lowercase}}{{persona}}{{/lowercase}}", personaContext),
    ).toBe("{{persona}}");
  });

  it("skips preview resolution for text without macro markers", () => {
    const context: MacroContext = {
      user: "Alex",
      char: "Mara",
      characters: ["Mara"],
      variables: {},
    };

    expect(resolveCatalogMacroPreview("Plain text", { macroContext: context })).toBeNull();
  });

  it("renders a preview only when macros resolve to different text", () => {
    const context = createPersonaCatalogMacroPreviewContext({ displayName: "Alex" });
    const withPreview = renderToStaticMarkup(
      createElement(CatalogMacroTextarea, {
        id: "field-with-preview",
        autoFocus: true,
        onValueChange: () => {},
        previewContext: context,
        value: "Hello {{persona}}",
      }),
    );
    const withoutPreview = renderToStaticMarkup(
      createElement(CatalogMacroTextarea, {
        id: "field-without-preview",
        onValueChange: () => {},
        previewContext: context,
        value: "Hello Alex",
      }),
    );

    expect(withPreview).toContain("catalog-macro-preview");
    expect(withPreview).toContain("Hello Alex");
    expect(withoutPreview).not.toContain("catalog-macro-preview");
  });

  it("does not resolve inactive textarea previews", () => {
    const context = createPersonaCatalogMacroPreviewContext({ displayName: "Alex" });
    const markup = renderToStaticMarkup(
      createElement(CatalogMacroTextarea, {
        id: "inactive-field",
        onValueChange: () => {},
        previewContext: context,
        value: "Hello {{persona}}",
      }),
    );

    expect(markup).not.toContain("catalog-macro-preview");
  });
});
