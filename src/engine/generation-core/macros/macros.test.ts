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

  it("applies complete case blocks inside unknown macro bodies", () => {
    expect(resolveMacros("{{unknown {{uppercase}}{{user}}{{/uppercase}}}}", macroContext())).toBe(
      "{{unknown ALEX}}",
    );
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
