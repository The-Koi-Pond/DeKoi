import { describe, expect, it } from "vitest";

import { SUPPORTED_MACRO_DEFINITIONS } from "./macro-definitions";
import { findMacroSpanClose, mapMacroSpans } from "./macro-spans";
import { SUPPORTED_MACROS, resolveMacros, type MacroContext } from "./macro-engine";

function macroContext(input: Partial<MacroContext> = {}): MacroContext {
  return {
    user: "Alex",
    char: "Mara",
    characters: ["Mara"],
    variables: {},
    ...input,
  };
}

function characterMacroFields(
  input: Partial<NonNullable<MacroContext["characterFields"]>> = {},
): NonNullable<MacroContext["characterFields"]> {
  return {
    displayName: "",
    nickname: "",
    description: "",
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
    ...input,
  };
}

function expectedTimeParts(now: string, timeZone: string) {
  const date = new Date(now);

  return {
    date: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      timeZone,
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(date),
    timeZone: new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone,
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    }).format(date),
  };
}

function sequenceRandom(values: number[]) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

function throwingRandom(): never {
  throw new Error("Random macro should not be evaluated");
}

function supportedMacroContext() {
  return macroContext({
    characterFields: characterMacroFields({
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
    }),
    chatId: "thread-1",
    idleDuration: "12 minutes",
    lastGenerationType: "normal",
    lastInput: "hello",
    model: "local-model",
    now: "2026-07-04T13:05:06.000Z",
    personaFields: { displayName: "Alex" },
    timeZone: "UTC",
    variables: { name: "stored" },
  });
}

function supportedMacroSample(id: string) {
  switch (id) {
    case "uppercase":
      return { template: "{{uppercase}}mixed{{/uppercase}}", expected: "MIXED" };
    case "lowercase":
      return { template: "{{lowercase}}MIXED{{/lowercase}}", expected: "mixed" };
    case "comment":
      return { template: "A{{// comment}}B", expected: "AB" };
    case "if":
      return { template: "{{#if user}}yes{{else}}no{{/if}}", expected: "yes" };
    case "random-two-options":
      return { template: "{{random:A:B}}", expected: "A" };
    case "random-options":
      return { template: "{{random::A::B}}", expected: "A" };
    case "random-weighted":
      return { template: "{{random::A@2::B@0.5}}", expected: "A" };
    case "roll":
      return { template: "{{roll:2d6}}", expected: "2" };
    case "getvar":
      return { template: "{{getvar::name}}", expected: "stored" };
    case "setvar":
      return { template: "{{setvar::name::value}}{{getvar::name}}", expected: "value" };
    case "addvar":
      return { template: "{{setvar::name::2}}{{addvar::name::3}}{{getvar::name}}", expected: "5" };
    case "incvar":
      return { template: "{{setvar::name::2}}{{incvar::name}}{{getvar::name}}", expected: "3" };
    case "decvar":
      return { template: "{{setvar::name::2}}{{decvar::name}}{{getvar::name}}", expected: "1" };
    case "variable-name":
      return { template: "{{name}}", expected: "stored" };
    default:
      return null;
  }
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
  it("exports a unique active macro catalog for editor UI", () => {
    const ids = new Set(SUPPORTED_MACROS.map((macro) => macro.id));
    const syntaxes = SUPPORTED_MACROS.map((macro) => macro.syntax);

    expect(ids.size).toBe(SUPPORTED_MACROS.length);
    expect(SUPPORTED_MACROS).toEqual(
      SUPPORTED_MACRO_DEFINITIONS.map(({ category, description, id, insertText, syntax }) => ({
        category,
        description,
        id,
        insertText,
        syntax,
      })),
    );
    expect(syntaxes).toContain("{{user}}");
    expect(syntaxes).toContain("{{char}}");
    expect(syntaxes).toContain("{{#if condition}}...{{else}}...{{/if}}");
    expect(syntaxes).toContain("{{setvar::name::value}}");
    expect(syntaxes).not.toContain("{{agent::TYPE}}");
    expect(syntaxes).not.toContain("{{original}}");
  });

  it("describes user and persona macro outputs distinctly", () => {
    const descriptionFor = (syntax: string) => SUPPORTED_MACROS.find((macro) => macro.syntax === syntax)?.description;

    expect(descriptionFor("{{user}}")).toBe("Current user name.");
    expect(descriptionFor("{{userName}}")).toBe("Compatibility alias for the current user name.");
    expect(descriptionFor("{{persona}}")).toBe("Active persona name, or the user fallback.");
  });

  it("keeps supported macro definitions executable by the resolver", () => {
    for (const definition of SUPPORTED_MACRO_DEFINITIONS) {
      const sample = supportedMacroSample(definition.id);
      if (definition.kind === "pattern") {
        expect(sample, `Missing resolver sample for ${definition.id}`).not.toBeNull();
      }

      const template = sample?.template ?? definition.syntax;
      const expected = sample?.expected;
      const result = resolveMacros(template, supportedMacroContext(), {
        random: sequenceRandom([0]),
        trimResult: false,
      });

      if (expected !== undefined) {
        expect(result, definition.id).toBe(expected);
      } else {
        expect(result, definition.id).not.toBe(definition.syntax);
      }
    }
  });

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

  it("resolves time macros from an explicit time source and time zone", () => {
    const now = "2026-07-04T13:05:06.000Z";
    const expected = expectedTimeParts(now, "Australia/Sydney");
    const context = macroContext({
      now,
      timeZone: "Australia/Sydney",
    });

    expect(resolveMacros("{{weekday}}|{{date}}|{{time}}|{{timezone}}|{{isotime}}", context)).toBe(
      `${expected.weekday}|${expected.date}|${expected.time}|${expected.timeZone}|${now}`,
    );
  });

  it("applies time zones when formatting local date and weekday macros", () => {
    const now = "2026-07-04T01:05:06.000Z";
    const expected = expectedTimeParts(now, "America/New_York");
    const context = macroContext({
      now,
      timeZone: "America/New_York",
    });

    expect(resolveMacros("{{weekday}} {{date}} {{time}}", context)).toBe(
      `${expected.weekday} ${expected.date} ${expected.time}`,
    );
  });

  it("defaults missing macro time zones to UTC", () => {
    const now = "2026-07-04T13:05:06.000Z";
    const expected = expectedTimeParts(now, "UTC");
    const context = macroContext({ now });

    expect(resolveMacros("{{timezone}} {{time}}", context)).toBe(
      `${expected.timeZone} ${expected.time}`,
    );
  });

  it("snapshots omitted macro time once per resolver call", () => {
    const RealDate = Date;
    const samples = [
      new RealDate("2026-07-04T23:59:59.000Z"),
      new RealDate("2026-07-05T00:00:01.000Z"),
    ];
    let fallbackDateCalls = 0;

    class SteppingDate extends RealDate {
      constructor(value?: string | number | Date) {
        if (arguments.length === 0) {
          super(samples[Math.min(fallbackDateCalls, samples.length - 1)].getTime());
          fallbackDateCalls += 1;
          return;
        }

        super(value instanceof RealDate ? value.getTime() : (value ?? Number.NaN));
      }
    }

    globalThis.Date = SteppingDate as unknown as DateConstructor;

    try {
      expect(resolveMacros("{{date}}|{{isotime}}", macroContext({ timeZone: "UTC" }))).toBe(
        "July 4, 2026|2026-07-04T23:59:59.000Z",
      );
      expect(fallbackDateCalls).toBe(1);
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it("leaves time macros visible when the time context is invalid", () => {
    expect(resolveMacros("{{time}}/{{timezone}}", macroContext({ timeZone: "Mars/Base" }))).toBe(
      "{{time}}/{{timezone}}",
    );
    expect(resolveMacros("{{time}}/{{timezone}}", macroContext({ now: "invalid" }))).toBe(
      "{{time}}/UTC",
    );
  });

  it("resolves isotime when the time zone context is invalid", () => {
    const now = "2026-07-04T13:05:06.000Z";

    expect(
      resolveMacros(
        "{{isotime}}|{{time}}|{{date}}|{{weekday}}|{{timezone}}",
        macroContext({ now, timeZone: "Mars/Base" }),
      ),
    ).toBe(`${now}|{{time}}|{{date}}|{{weekday}}|{{timezone}}`);
  });

  it("resolves newline and trim marker macros", () => {
    expect(resolveMacros("A{{newline}}B", macroContext())).toBe("A\nB");
    expect(
      resolveMacros("x{{trimStart}}   y|x   {{trimEnd}}y|x   {{trim}}   y", macroContext(), {
        trimResult: false,
      }),
    ).toBe("xy|xy|xy");
  });

  it("keeps explicit format macros ahead of catch-all variable names", () => {
    const context = macroContext({
      variables: {
        newline: "shadow newline",
        trim: "shadow trim",
        trimEnd: "shadow trim end",
        trimStart: "shadow trim start",
      },
    });

    expect(resolveMacros("A{{newline}}B", context)).toBe("A\nB");
    expect(
      resolveMacros(
        "x{{trimStart}}   y|x   {{trimEnd}}y|x   {{trim}}   y|{{getvar::newline}}",
        context,
        { trimResult: false },
      ),
    ).toBe("xy|xy|xy|shadow newline");
  });

  it("removes trim markers before applying case block macros", () => {
    expect(
      resolveMacros(
        "{{lowercase}}X{{trimStart}}   Y|X   {{trimEnd}}Y|X   {{trim}}   Y{{/lowercase}}",
        macroContext(),
        { trimResult: false },
      ),
    ).toBe("xy|xy|xy");
  });

  it("applies case block macros after nested substitutions", () => {
    expect(
      resolveMacros(
        "{{uppercase}}hello {{user}}{{/uppercase}} {{lowercase}}LOUD {{char}}{{/lowercase}}",
        macroContext(),
      ),
    ).toBe("HELLO ALEX loud mara");
  });

  it("applies case block macros after recursive macro values stabilize", () => {
    const context = macroContext({ char: "{{user}}" });

    expect(resolveMacros("{{uppercase}}{{char}}{{/uppercase}}", context)).toBe("ALEX");
  });

  it("supports nested case blocks with matching close markers", () => {
    expect(
      resolveMacros("{{uppercase}}a {{uppercase}}b{{/uppercase}} c{{/uppercase}}", macroContext()),
    ).toBe("A B C");
  });

  it("leaves over-deep case blocks unchanged", () => {
    const input = `${"{{uppercase}}".repeat(80)}x${"{{/uppercase}}".repeat(80)}`;

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("leaves malformed case block macros visible after resolving nested content", () => {
    expect(resolveMacros("{{uppercase}}{{user}}", macroContext())).toBe("{{uppercase}}Alex");
  });

  it("leaves crossed case block markers unchanged", () => {
    const input = "{{uppercase}}a {{lowercase}}b{{/uppercase}} c{{/lowercase}}";

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("leaves case blocks inside malformed macro tails unchanged", () => {
    const input = "before {{missing {{uppercase}}x{{/uppercase}}";

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("leaves case blocks that cross macro span boundaries unchanged", () => {
    const input = "{{unknown {{uppercase}}}}x{{/uppercase}}";

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("leaves complete case blocks inside unknown macro bodies inert", () => {
    expect(resolveMacros("{{unknown {{uppercase}}{{user}}{{/uppercase}}}}", macroContext())).toBe(
      "{{unknown {{USER}}}}",
    );
  });

  it("uses the persona display name for persona macros when available", () => {
    const context = macroContext({ personaFields: { displayName: "River" } });

    expect(resolveMacros("{{persona}} as {{user}}", context)).toBe("River as Alex");
  });

  it("removes comment macros", () => {
    expect(resolveMacros("A{{// hidden {{user}} }}B", macroContext())).toBe("AB");
  });

  it("strips comment macros before evaluating nested random content", () => {
    expect(
      resolveMacros("A{{// {{random::A::B}} }}B", macroContext(), { random: throwingRandom }),
    ).toBe("AB");
    expect(
      resolveMacros("A{{ // {{random::A::B}} }}B", macroContext(), { random: throwingRandom }),
    ).toBe("AB");
  });

  it("strips nested comment macros inside unresolved outer spans without evaluating them", () => {
    expect(
      resolveMacros("{{unknown {{// {{random::A::B}} }}{{user}}}}", macroContext(), {
        random: throwingRandom,
      }),
    ).toBe("{{unknown {{user}}}}");
  });

  it("resolves simple control macros to empty strings", () => {
    expect(resolveMacros("A{{noop}}B{{banned}}C", macroContext())).toBe("ABC");
  });

  it("resolves if blocks with truthy fallback and else branches", () => {
    const context = macroContext();

    expect(resolveMacros("{{#if user}}yes{{else}}no{{/if}}", context)).toBe("yes");
    expect(resolveMacros("{{ #if user}}yes{{ else }}no{{ /if }}", context)).toBe("yes");
    expect(resolveMacros("{{#if model}}yes{{else}}no{{/if}}", context)).toBe("no");
    expect(resolveMacros("{{#if model}}yes{{/if}}", context)).toBe("");
  });

  it("supports comparison and containment condition operators", () => {
    const context = macroContext({ characters: ["Mara", "Koi"] });

    expect(
      resolveMacros(
        [
          '{{#if char == "Mara"}}eq{{/if}}',
          "{{#if char != user}}ne{{/if}}",
          "{{#if char is \u201cMara\u201d}}is{{/if}}",
          "{{#if char contains ar}}contains{{/if}}",
          "{{#if characters includes Koi}}includes{{/if}}",
        ].join("|"),
        context,
      ),
    ).toBe("eq|ne|is|contains|includes");
  });

  it("supports compact word condition operators before quoted operands", () => {
    const context = macroContext({ characters: ["Mara", "Koi"] });

    expect(
      resolveMacros(
        [
          '{{#if char is"Mara"}}is{{/if}}',
          '{{#if characters includes"Koi"}}includes{{/if}}',
          "{{#if char is{{user}}}}bad{{else}}macro{{/if}}",
        ].join("|"),
        context,
      ),
    ).toBe("is|includes|macro");
  });

  it("resolves nested macro operands and only evaluates the selected if branch", () => {
    expect(
      resolveMacros(
        '{{#if {{char}} == "Mara"}}Hi {{user}}{{else}}{{random::bad::worse}}{{/if}}',
        macroContext(),
        { random: throwingRandom },
      ),
    ).toBe("Hi Alex");
  });

  it("resolves structural macros produced while resolving condition operands", () => {
    expect(
      resolveMacros(
        '{{#if char == "Mara"}}yes{{else}}no{{/if}}',
        macroContext({
          char: "{{displayName}}",
          characterFields: characterMacroFields({
            displayName: "{{#if user}}Mara{{else}}Nope{{/if}}",
          }),
        }),
      ),
    ).toBe("yes");

    expect(
      resolveMacros(
        '{{#if char == "Mara"}}yes{{else}}no{{/if}}',
        macroContext({
          char: "{{displayName}}",
          characterFields: characterMacroFields({
            displayName: "{{// hidden}}Mara",
          }),
        }),
      ),
    ).toBe("yes");
  });

  it("leaves recursive condition operands visible when the depth guard is exhausted", () => {
    const input = "{{#if char}}yes{{/if}}";

    expect(resolveMacros(input, macroContext({ char: "{{#if char}}x{{/if}}" }))).toBe(input);
  });

  it("leaves unresolved condition block contents inert", () => {
    const input = "{{user}} {{#if char}}Hi {{user}} {{// hidden }}{{random::A::B}}{{/if}}";
    const expected = "Alex {{#if char}}Hi {{user}} {{// hidden }}{{random::A::B}}{{/if}}";

    expect(
      resolveMacros(input, macroContext({ char: "{{#if char}}x{{/if}}" }), {
        random: throwingRandom,
      }),
    ).toBe(expected);
  });

  it("leaves format blocks inside unresolved condition blocks inert", () => {
    const input = "{{#if char}}{{uppercase}}mara{{/uppercase}}{{/if}}";

    expect(resolveMacros(input, macroContext({ char: "{{#if char}}x{{/if}}" }))).toBe(input);
  });

  it("leaves unresolved condition blocks inert inside enclosing case blocks", () => {
    const context = macroContext({ char: "{{#if char}}x{{/if}}" });

    expect(
      resolveMacros("{{lowercase}}A {{#if char}}Hi {{user}}{{/if}} B{{/lowercase}}", context),
    ).toBe("a {{#if char}}Hi {{user}}{{/if}} b");
    expect(
      resolveMacros("{{uppercase}}a {{#if char}}Hi {{user}}{{/if}} b{{/uppercase}}", context),
    ).toBe("A {{#if char}}Hi {{user}}{{/if}} B");
  });

  it("leaves recursive condition operands visible when replacement passes overflow", () => {
    const input = "{{#if char}}yes{{/if}}";

    expect(resolveMacros(input, macroContext({ char: "{{char}}x" }))).toBe(input);
  });

  it("applies format postprocessors while resolving condition operands", () => {
    expect(
      resolveMacros(
        '{{#if char == "MARA"}}yes{{else}}no{{/if}}',
        macroContext({
          char: "{{displayName}}",
          characterFields: characterMacroFields({
            displayName: "{{uppercase}}mara{{/uppercase}}",
          }),
        }),
      ),
    ).toBe("yes");
  });

  it("supports nested if blocks in selected branches", () => {
    expect(
      resolveMacros("{{#if user}}{{#if model}}bad{{else}}ok{{/if}}{{/if}}", macroContext()),
    ).toBe("ok");
  });

  it("leaves malformed if blocks visible", () => {
    const input = "{{#if user}}yes{{else}}no";

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("leaves malformed if block contents inert", () => {
    const input =
      "{{user}} {{#if user}}Hi {{char}} {{random::A::B}} {{uppercase}}mara{{/uppercase}}";
    const expected =
      "Alex {{#if user}}Hi {{char}} {{random::A::B}} {{uppercase}}mara{{/uppercase}}";

    expect(resolveMacros(input, macroContext(), { random: throwingRandom })).toBe(expected);
  });

  it("leaves condition blocks visible when the condition contains a malformed span", () => {
    const input = '{{#if "{{" == "Mara"}}yes{{else}}no{{/if}}';

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("treats additional same-depth else markers as selected branch content", () => {
    expect(resolveMacros("{{#if model}}a{{else}}b{{else}}c{{/if}}", macroContext())).toBe(
      "b{{else}}c",
    );
  });

  it("resolves random macros with deterministic injected random samples", () => {
    expect(
      resolveMacros("{{random}}|{{random:X:Y}}|{{random::A::B::C}}", macroContext(), {
        random: sequenceRandom([0.25, 0.75, 0.99]),
      }),
    ).toBe("0.25|Y|C");
  });

  it("treats single-colon random macros as exactly two options", () => {
    expect(
      resolveMacros("{{random:A:B:C}}|{{random:A:B:C}}", macroContext(), {
        random: sequenceRandom([0.25, 0.75]),
      }),
    ).toBe("A|B:C");
  });

  it("leaves single-colon random macros without two options visible", () => {
    const input = "{{random:A}} {{random:}}";

    expect(resolveMacros(input, macroContext(), { random: throwingRandom })).toBe(input);
  });

  it("resolves nested macros inside random options before selection", () => {
    expect(
      resolveMacros("{{random::{{user}}::{{char}}}}", macroContext(), {
        random: sequenceRandom([0.75]),
      }),
    ).toBe("Mara");
  });

  it("only commits variable mutations from the selected random option", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({ variables: {}, variableMutations });

    expect(
      resolveMacros(
        "{{random::{{setvar::route::left}}left::{{setvar::route::right}}right}}{{getvar::route}}",
        context,
        { random: sequenceRandom([0.25]) },
      ),
    ).toBe("leftleft");
    expect(context.variables).toEqual({ route: "left" });
    expect(variableMutations).toEqual([{ kind: "set", name: "route", value: "left" }]);
  });

  it("resolves selected random options through structural macro scope", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({ variables: {}, variableMutations });

    expect(
      resolveMacros(
        [
          "{{random::{{#if model}}{{setvar::route::bad}}{{else}}ok{{/if}}::fallback}}|{{getvar::route}}",
          "{{random::{{// {{setvar::comment::bad}} }}ok::fallback}}|{{getvar::comment}}",
        ].join(","),
        context,
        { random: sequenceRandom([0.25, 0.25]) },
      ),
    ).toBe("ok|,ok|");
    expect(context.variables).toEqual({});
    expect(variableMutations).toEqual([]);
  });

  it("ignores random option separators inside balanced structural blocks", () => {
    expect(
      resolveMacros(
        "{{random::{{#if user}}A::B{{/if}}::C}}|{{random::{{#if user}}A::B{{/if}}::C}}",
        macroContext(),
        { random: sequenceRandom([0.25, 0.5]) },
      ),
    ).toBe("A::B|C");
  });

  it("ignores random option separators inside balanced format blocks", () => {
    expect(
      resolveMacros(
        "{{random::{{uppercase}}a::b{{/uppercase}}::{{lowercase}}C::D{{/lowercase}}}}|{{random::{{uppercase}}a::b{{/uppercase}}::{{lowercase}}C::D{{/lowercase}}}}",
        macroContext(),
        { random: sequenceRandom([0.25, 0.75]) },
      ),
    ).toBe("A::B|c::d");
  });

  it("applies relative decimal weights and excludes zero-weight random options", () => {
    expect(
      resolveMacros(
        "{{random::A@2::B@1}}|{{random::A@0::B@0.5::C@1.5}}|{{random::A@0::B@0.5::C@1.5}}",
        macroContext(),
        { random: sequenceRandom([0.8, 0.2, 0.3]) },
      ),
    ).toBe("B|B|C");
  });

  it("only treats trailing numeric @ markers as random weights", () => {
    expect(
      resolveMacros("{{random::a@example.com::ignored@0}}", macroContext(), {
        random: sequenceRandom([0.99]),
      }),
    ).toBe("a@example.com");
  });

  it("resolves dice roll macros with deterministic injected random samples", () => {
    expect(
      resolveMacros("{{roll:2d6}}|{{roll:3D4}}", macroContext(), {
        random: sequenceRandom([0, 0.999, 0.5, 0.5, 0.5]),
      }),
    ).toBe("7|9");
  });

  it("leaves invalid dice roll macros visible", () => {
    const input = "{{roll:0d6}} {{roll:2d0}} {{roll:1001d6}} {{roll:bad}}";

    expect(resolveMacros(input, macroContext())).toBe(input);
  });

  it("resolves variable reads and catch-all variable names", () => {
    const context = macroContext({
      variables: {
        Mara_mood: "focused",
        POV: "close third",
      },
    });

    expect(resolveMacros("{{getvar::POV}}|{{POV}}|{{getvar::{{char}}_mood}}", context)).toBe(
      "close third|close third|focused",
    );
  });

  it("leaves unknown macros visible when no matching variable exists", () => {
    const context = macroContext({ variables: { POV: "close third" } });

    expect(resolveMacros("{{missing}} {{unknown::{{user}}}}", context)).toBe(
      "{{missing}} {{unknown::{{user}}}}",
    );
  });

  it("mutates variables left-to-right and renders mutations as empty strings", () => {
    const context = macroContext({ variables: { count: "1", mood: "calm" } });

    expect(
      resolveMacros(
        "{{setvar::mood::happy}}{{mood}}|{{addvar::count::2.5}}{{getvar::count}}|{{incvar::count}}{{decvar::missing}}{{getvar::count}}/{{missing}}",
        context,
      ),
    ).toBe("happy|3.5|4.5/-1");
    expect(context.variables).toEqual({
      count: "4.5",
      missing: "-1",
      mood: "happy",
    });
  });

  it("applies recursive variable mutations before later prompt spans", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{displayName}}",
      characterFields: characterMacroFields({
        displayName: "{{setvar::mood::calm}}",
      }),
      variables: {},
      variableMutations,
    });

    expect(resolveMacros("{{char}}{{getvar::mood}}", context)).toBe("calm");
    expect(context.variables).toEqual({ mood: "calm" });
    expect(variableMutations).toEqual([{ kind: "set", name: "mood", value: "calm" }]);
  });

  it("coerces arithmetic variable values through finite numbers", () => {
    const context = macroContext({ variables: { score: "not numeric" } });

    expect(
      resolveMacros(
        "{{addvar::score::2}}{{getvar::score}}|{{addvar::score::nope}}{{getvar::score}}",
        context,
      ),
    ).toBe("2|2");
    expect(context.variables.score).toBe("2");
  });

  it("strips comment macros before evaluating nested variable side effects", () => {
    const context = macroContext({ variables: { mood: "calm" } });

    expect(resolveMacros("A{{// {{setvar::mood::bad}} }}B", context)).toBe("AB");
    expect(context.variables.mood).toBe("calm");
  });

  it("resolves variables as condition operands", () => {
    const context = macroContext({ variables: { empty: "", mood: "happy" } });

    expect(
      resolveMacros(
        "{{#if mood == happy}}yes{{else}}no{{/if}}|{{#if empty}}bad{{else}}empty{{/if}}",
        context,
      ),
    ).toBe("yes|empty");
  });

  it("treats unknown bare condition operands as literals", () => {
    const context = macroContext({ variables: { mood: "happy", "quest-done": "yes" } });

    expect(
      resolveMacros(
        [
          "{{#if questComplete}}yes{{else}}no{{/if}}",
          "{{#if quest-complete}}yes{{else}}no{{/if}}",
          "{{#if Dragon}}dragon{{else}}missing{{/if}}",
          "{{#if getvar::questComplete}}yes{{else}}no{{/if}}",
          "{{#if getvar::quest-complete}}yes{{else}}no{{/if}}",
          "{{#if quest-done}}done{{else}}missing{{/if}}",
          "{{#if mood}}mood{{else}}missing{{/if}}",
          "{{#if literal}}literal{{else}}missing{{/if}}",
          '{{#if "literal"}}literal{{else}}missing{{/if}}',
          "{{questComplete}}",
        ].join("|"),
        context,
      ),
    ).toBe("yes|yes|dragon|no|no|done|mood|literal|literal|{{questComplete}}");
  });

  it("treats unknown binary operands as literals", () => {
    const context = macroContext({ variables: { "quest-done": "yes" } });

    expect(
      resolveMacros(
        [
          '{{#if questComplete == ""}}bad{{else}}literal{{/if}}',
          '{{#if quest-complete is ""}}bad{{else}}hyphen-literal{{/if}}',
          '{{#if questComplete != ""}}not-empty{{else}}bad{{/if}}',
          '{{#if literal == ""}}bad{{else}}literal{{/if}}',
          '{{#if Dragon contains "rag"}}dragon{{else}}bad{{/if}}',
          '{{#if getvar::questComplete == ""}}empty{{else}}bad{{/if}}',
          '{{#if quest-done == "yes"}}done{{else}}bad{{/if}}',
        ].join("|"),
        context,
      ),
    ).toBe("literal|hyphen-literal|not-empty|literal|dragon|empty|done");
  });

  it("does not parse word condition operators inside bare variable names", () => {
    const context = macroContext({
      variables: {
        "bag-contains-key": "yes",
        "door-is-open": "yes",
        "list-includes-map": "yes",
      },
    });

    expect(
      resolveMacros(
        [
          "{{#if door-is-open}}open{{else}}closed{{/if}}",
          "{{#if bag-contains-key}}key{{else}}missing{{/if}}",
          "{{#if list-includes-map}}map{{else}}missing{{/if}}",
        ].join("|"),
        context,
      ),
    ).toBe("open|key|map");
  });

  it("rolls back variable mutations when condition operands stay unresolved", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}x{{/if}}",
      variables: { mood: "calm" },
      variableMutations,
    });
    const input = "{{user}} {{#if {{setvar::mood::bad}}{{char}}}}yes{{/if}} {{mood}}";

    expect(resolveMacros(input, context)).toBe(
      "Alex {{#if {{setvar::mood::bad}}{{char}}}}yes{{/if}} calm",
    );
    expect(context.variables).toEqual({ mood: "calm" });
    expect(variableMutations).toEqual([]);
  });

  it("rolls back selected branch mutations when nested conditions stay unresolved", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}x{{/if}}",
      variables: { mood: "" },
      variableMutations,
    });
    const input =
      "{{#if user}}{{#if {{setvar::mood::bad}}user}}ok{{/if}}{{#if char}}inner{{/if}}{{#if mood}}after{{/if}}{{/if}}|{{getvar::mood}}";

    expect(resolveMacros(input, context)).toBe("ok{{#if char}}inner{{/if}}|");
    expect(context.variables).toEqual({ mood: "" });
    expect(variableMutations).toEqual([]);
  });

  it("leaves variable macros inside exhausted selected branches inert", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}x{{/if}}",
      variables: { mood: "calm" },
      variableMutations,
    });
    const input =
      "{{#if user}}{{setvar::mood::bad}}{{mood}}{{#if char}}x{{/if}}{{/if}}|{{getvar::mood}}";

    expect(resolveMacros(input, context)).toBe(
      "{{setvar::mood::bad}}{{mood}}{{#if char}}x{{/if}}|calm",
    );
    expect(context.variables).toEqual({ mood: "calm" });
    expect(variableMutations).toEqual([]);
  });

  it("rolls back selected random option mutations when inline structural resolution exhausts", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}x{{/if}}",
      variables: {},
      variableMutations,
    });

    expect(
      resolveMacros(
        "{{random::{{#if char}}blocked{{/if}}{{setvar::seen::1}}::fallback}}|{{getvar::seen}}",
        context,
        { random: sequenceRandom([0.25]) },
      ),
    ).toBe("{{#if char}}blocked{{/if}}|");
    expect(context.variables).toEqual({});
    expect(variableMutations).toEqual([]);
  });

  it("rolls back recursive replacement mutations when inline structural resolution exhausts", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}blocked{{/if}}{{setvar::seen::1}}",
      variables: {},
      variableMutations,
    });

    expect(resolveMacros("{{char}}|{{getvar::seen}}", context)).toBe("{{#if char}}blocked{{/if}}|");
    expect(context.variables).toEqual({});
    expect(variableMutations).toEqual([]);
  });

  it("keeps independent variable mutations before unresolved conditions", () => {
    const variableMutations: NonNullable<MacroContext["variableMutations"]> = [];
    const context = macroContext({
      char: "{{#if char}}x{{/if}}",
      variables: {},
      variableMutations,
    });
    const input = "{{setvar::seen::1}}{{#if char}}blocked{{/if}}|{{getvar::seen}}";

    expect(resolveMacros(input, context)).toBe("{{#if char}}blocked{{/if}}|1");
    expect(context.variables).toEqual({ seen: "1" });
    expect(variableMutations).toEqual([{ kind: "set", name: "seen", value: "1" }]);
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

  it("leaves nested macros inside unknown outer macros inert", () => {
    expect(resolveMacros("{{unknown::{{user}}}}", macroContext())).toBe("{{unknown::{{user}}}}");
  });

  it("leaves nested variable mutations inside unknown outer macros inert", () => {
    const context = macroContext({ variables: {} });

    expect(resolveMacros("{{unknown::{{setvar::x::y}}}}{{getvar::x}}", context)).toBe(
      "{{unknown::{{setvar::x::y}}}}",
    );
    expect(context.variables).toEqual({});
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

  it("rolls back variable mutations when replacement recursion overflows", () => {
    const context = macroContext({
      char: "{{char}}x",
      variables: { mood: "calm" },
    });

    expect(resolveMacros("{{setvar::mood::bad}}{{char}}", context)).toBe(
      "{{setvar::mood::bad}}{{char}}",
    );
    expect(context.variables).toEqual({ mood: "calm" });
  });

  it("applies the final trim rule to overflow output", () => {
    const context = macroContext({ char: "{{char}}x" });

    expect(resolveMacros("  {{char}}  ", context)).toBe("{{char}}");
    expect(resolveMacros("  {{char}}  ", context, { trimResult: false })).toBe("  {{char}}  ");
  });
});
