import { describe, expect, it } from "vitest";

import { insertMacroText } from "./catalogMacroText";

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
