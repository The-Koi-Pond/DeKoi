import { describe, expect, it } from "vitest";

import {
  GENERATION_PARAMETER_SPEC,
  STANDARD_GENERATION_PARAMETER_KEYS,
  normalizeGenerationParameterEntry,
  strictGenerationParameterEntryIsValid,
} from "./generation-parameter-contract";

describe("generation parameter contract", () => {
  it("exports every standard outbound key from the canonical spec", () => {
    expect(STANDARD_GENERATION_PARAMETER_KEYS).toEqual(Object.keys(GENERATION_PARAMETER_SPEC));
    expect(STANDARD_GENERATION_PARAMETER_KEYS).toEqual([
      "maxTokens",
      "temperature",
      "topP",
      "topK",
      "minP",
      "frequencyPenalty",
      "presencePenalty",
      "reasoningEffort",
      "verbosity",
      "serviceTier",
      "stopSequences",
    ]);
  });

  it("enforces sent numeric constraints while preserving finite disabled drafts", () => {
    expect(normalizeGenerationParameterEntry("temperature", { send: true, value: 3 })).toBeNull();
    expect(normalizeGenerationParameterEntry("maxTokens", { send: true, value: 1.5 })).toBeNull();
    expect(normalizeGenerationParameterEntry("temperature", { send: false, value: 3 })).toEqual({
      send: false,
      value: 3,
    });
    expect(normalizeGenerationParameterEntry("temperature", { send: false, value: null })).toEqual({
      send: false,
      value: null,
    });
  });

  it("normalizes valid standard entries and rejects strict extra members", () => {
    expect(
      normalizeGenerationParameterEntry("stopSequences", {
        send: true,
        value: ["  END  ", "STOP"],
      }),
    ).toEqual({ send: true, value: ["END", "STOP"] });
    expect(
      strictGenerationParameterEntryIsValid("temperature", {
        send: true,
        value: 0.7,
        enabled: true,
      }),
    ).toBe(false);
    expect(
      strictGenerationParameterEntryIsValid("reasoningEffort", {
        send: true,
        value: "maximum",
      }),
    ).toBe(false);
  });

  it("keeps strict validation raw while permissive normalization remains coercive", () => {
    const canonicalStopEntry = { send: true, value: ["END", "STOP"] };

    expect(strictGenerationParameterEntryIsValid("temperature", '{"send":true,"value":0.7}')).toBe(
      false,
    );
    expect(
      strictGenerationParameterEntryIsValid("stopSequences", {
        send: true,
        value: ["  END  "],
      }),
    ).toBe(false);
    expect(strictGenerationParameterEntryIsValid("stopSequences", canonicalStopEntry)).toBe(true);
    expect(normalizeGenerationParameterEntry("temperature", '{"send":true,"value":0.7}')).toEqual({
      send: true,
      value: 0.7,
    });
    expect(
      normalizeGenerationParameterEntry("stopSequences", {
        send: true,
        value: ["  END  "],
      }),
    ).toEqual({ send: true, value: ["END"] });
  });
});
