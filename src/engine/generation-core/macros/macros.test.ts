import { describe, expect, it } from "vitest";

import { findMacroSpanClose, mapMacroSpans } from "./macro-spans";
import { resolveMacros, type MacroContext } from "./macro-engine";

function macroContext(input: Partial<MacroContext> = {}): MacroContext {
  return {
    user: "Alex",
    char: "Mara",
    characters: ["Mara"],
    ...input,
  };
}

describe("macro balance helpers", () => {
  it("finds the end of a balanced macro span with nested macros", () => {
    const input = "a {{outer::{{inner}}}} z";
    const start = input.indexOf("{{");
    const end = findMacroSpanClose(input, start);

    expect(input.slice(start, end ?? 0)).toBe("{{outer::{{inner}}}}");
  });

  it("leaves malformed macro spans untouched", () => {
    const input = "before {{missing";

    expect(mapMacroSpans(input, () => "resolved")).toBe(input);
  });

  it("replaces nested macros before the containing macro", () => {
    const result = mapMacroSpans("{{outer {{inner}}}}", ({ body }) =>
      body === "inner" ? "INNER" : `[${body}]`,
    );

    expect(result).toBe("[outer INNER]");
  });

  it("leaves spans beyond the parser depth guard untouched", () => {
    const input = `${"{{".repeat(80)}user${"}}".repeat(80)}`;

    expect(findMacroSpanClose(input, 0)).toBeNull();
    expect(mapMacroSpans(input, () => "resolved")).toBe(input);
  });
});

describe("resolveMacros", () => {
  it("resolves identity macros and character lists", () => {
    const context = macroContext({ characters: ["Mara", "Koi"] });

    expect(
      resolveMacros("{{user}}/{{userName}} -> {{char}}/{{charName}} in {{characters}}", context),
    ).toBe("Alex/Alex -> Mara/Mara in Mara, Koi");
  });

  it("matches macro names after trimming whitespace", () => {
    expect(resolveMacros("{{ char }} sees {{ user }}", macroContext())).toBe("Mara sees Alex");
  });

  it("resolves character field and generation context macros", () => {
    const context = macroContext({
      characterFields: {
        displayName: "Mara",
        nickname: "Mar",
        description: "Moon archivist.",
        personality: "Dry and curious.",
        scenario: "Testing the archive.",
        firstMessage: "You're late.",
        exampleMessages: "Mara: Obviously.",
        systemPrompt: "Stay precise.",
        postHistoryInstructions: "Keep the reply brief.",
        creator: "DeKoi",
        characterVersion: "contract",
        creatorNotes: "No copied source material.",
        characterNote: "Tracks lunar keys.",
      },
      chatId: "thread-1",
      idleDuration: "12 minutes",
      lastGenerationType: "normal",
      lastInput: "hello",
      model: "local-model",
    });

    expect(
      resolveMacros(
        [
          "{{displayName}}",
          "{{nickname}}",
          "{{description}}",
          "{{personality}}",
          "{{scenario}}",
          "{{firstMessage}}",
          "{{exampleMessages}}",
          "{{systemPrompt}}",
          "{{postHistoryInstructions}}",
          "{{creator}}",
          "{{characterVersion}}",
          "{{creatorNotes}}",
          "{{characterNote}}",
          "{{input}}",
          "{{model}}",
          "{{chatId}}",
          "{{lastGenerationType}}",
          "{{idle_duration}}",
        ].join("|"),
        context,
      ),
    ).toBe(
      "Mara|Mar|Moon archivist.|Dry and curious.|Testing the archive.|You're late.|Mara: Obviously.|Stay precise.|Keep the reply brief.|DeKoi|contract|No copied source material.|Tracks lunar keys.|hello|local-model|thread-1|normal|12 minutes",
    );
  });

  it("resolves missing character and context field values to empty strings", () => {
    expect(resolveMacros("A{{description}}B{{model}}C", macroContext())).toBe("ABC");
  });

  it("uses the persona display name for persona macros when available", () => {
    const context = macroContext({ personaFields: { displayName: "River" } });

    expect(resolveMacros("{{persona}} as {{user}}", context)).toBe("River as Alex");
  });

  it("removes comment macros", () => {
    expect(resolveMacros("A{{// hidden {{user}} }}B", macroContext())).toBe("AB");
  });

  it("resolves nested macro values across passes", () => {
    const context = macroContext({ char: "{{user}}" });

    expect(resolveMacros("Reply as {{char}}.", context)).toBe("Reply as Alex.");
  });

  it("keeps a stable result produced by the final allowed pass", () => {
    const context = macroContext({
      char: "{{displayName}}",
      characterFields: {
        displayName: "{{nickname}}",
        nickname: "{{description}}",
        description: "{{personality}}",
        personality: "{{scenario}}",
        scenario: "{{firstMessage}}",
        firstMessage: "{{exampleMessages}}",
        exampleMessages: "{{systemPrompt}}",
        systemPrompt: "{{postHistoryInstructions}}",
        postHistoryInstructions: "{{creator}}",
        creator: "{{characterVersion}}",
        characterVersion: "{{creatorNotes}}",
        creatorNotes: "{{characterNote}}",
        characterNote: "{{input}}",
      },
      lastInput: "{{model}}",
      model: "stable",
    });

    expect(resolveMacros("{{char}}", context)).toBe("stable");
  });

  it("leaves over-deep resolved macro spans unchanged", () => {
    const input = `${"{{".repeat(80)}user${"}}".repeat(80)}`;

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("resolves nested macros inside unknown outer macros, then leaves the outer macro", () => {
    expect(resolveMacros("{{unknown::{{user}}}}", macroContext())).toBe("{{unknown::Alex}}");
  });

  it("leaves unknown, empty, and malformed macros unchanged", () => {
    expect(resolveMacros("{{missing}} {{}} {{user", macroContext())).toBe(
      "{{missing}} {{}} {{user",
    );
  });

  it("trims the final output by default and can preserve edges", () => {
    const context = macroContext();

    expect(resolveMacros("  {{user}}  ", context)).toBe("Alex");
    expect(resolveMacros("  {{user}}  ", context, { trimResult: false })).toBe("  Alex  ");
  });

  it("returns the original input when replacement recursion overflows", () => {
    const context = macroContext({ char: "{{char}}x" });

    expect(resolveMacros("{{char}}", context)).toBe("{{char}}");
  });

  it("applies the final trim rule to overflow output", () => {
    const context = macroContext({ char: "{{char}}x" });

    expect(resolveMacros("  {{char}}  ", context)).toBe("{{char}}");
    expect(resolveMacros("  {{char}}  ", context, { trimResult: false })).toBe("  {{char}}  ");
  });
});
