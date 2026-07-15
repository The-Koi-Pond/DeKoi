import { describe, expect, it } from "vitest";

import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import { createGenerationParameters } from "./generation";

const connection = { maxOutput: 512 } as ProviderConnectionRecord;

describe("provider-neutral generation parameters", () => {
  it("distinguishes an absent preset entry from an omission tombstone", () => {
    expect(
      createGenerationParameters({ maxTokens: 400, temperature: 0, topP: 0 }, connection, null),
    ).toEqual({ maxTokens: 400, temperature: 0, topP: 0 });

    expect(
      createGenerationParameters({ maxTokens: 400, temperature: 0, topP: 0 }, connection, {
        maxTokens: { send: false, value: null },
        temperature: { send: false, value: null },
        topP: { send: false, value: null },
      }),
    ).toEqual({});
  });

  it("caps an effectively present maxTokens value without recreating an omitted one", () => {
    expect(
      createGenerationParameters(undefined, connection, {
        maxTokens: { send: true, value: 1000 },
      }),
    ).toMatchObject({ maxTokens: 512 });
    expect(
      createGenerationParameters(undefined, connection, {
        maxTokens: { send: false, value: null },
      }),
    ).not.toHaveProperty("maxTokens");
  });

  it("preserves empty arrays, zeroes, false custom values, and omits local fields", () => {
    expect(
      createGenerationParameters(undefined, null, {
        topK: { send: true, value: 0 },
        stopSequences: { send: true, value: [] },
        customParameters: {
          feature_enabled: { send: true, value: false },
          ignored: { send: false, value: "saved" },
        },
        squashSystemMessages: true,
        strictRoleFormatting: true,
        singleUserMessage: true,
      }),
    ).toEqual({
      maxTokens: 1024,
      temperature: 0.8,
      topP: 0.95,
      topK: 0,
      stopSequences: [],
      customParameters: { feature_enabled: false },
    });
  });
});
