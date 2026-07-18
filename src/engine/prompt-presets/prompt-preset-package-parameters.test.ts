import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { createPromptPresetPackage, normalizePromptPresetPackage } from "./prompt-preset-package";

const exportedAt = "2026-07-11T00:00:00.000Z";

function parameterPreset(): PromptPresetRecord {
  return {
    id: "prompt-preset-parameters",
    schemaVersion: 2,
    name: "Parameter Preset",
    messengerPrompt: "Write the next response.",
    parameters: {
      maxTokens: { send: true, value: 2048 },
      temperature: { send: true, value: 0.8 },
      topP: { send: true, value: 0.9 },
      topK: { send: true, value: 40 },
      minP: { send: true, value: 0.05 },
      maxContext: 32_768,
      frequencyPenalty: { send: true, value: 0.2 },
      presencePenalty: { send: true, value: 0.1 },
      reasoningEffort: { send: true, value: "medium" },
      verbosity: { send: true, value: "low" },
      serviceTier: { send: true, value: "priority" },
      customParameters: { repetition_penalty: { send: true, value: 1.1 } },
      stopSequences: { send: true, value: ["</reply>"] },
    },
    sectionOrder: [],
    groupOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: exportedAt,
    updatedAt: exportedAt,
  };
}

describe("prompt preset package parameters", () => {
  it("round-trips a null-valued omission tombstone without inventing a value", () => {
    const preset = parameterPreset();
    preset.parameters = {
      ...preset.parameters,
      temperature: { send: false, value: null },
    };

    expect(
      normalizePromptPresetPackage(createPromptPresetPackage(preset, exportedAt))?.parameters
        ?.temperature,
    ).toEqual({ send: false, value: null });
  });

  it("round-trips disabled out-of-range values for later editing", () => {
    const preset = parameterPreset();
    preset.parameters = {
      ...preset.parameters,
      temperature: { send: false, value: 3 },
    };

    expect(
      normalizePromptPresetPackage(createPromptPresetPackage(preset, exportedAt))?.parameters
        ?.temperature,
    ).toEqual({ send: false, value: 3 });
  });

  it("round-trips sent custom JSON null", () => {
    const preset = parameterPreset();
    preset.parameters = {
      ...preset.parameters,
      customParameters: { nullable_feature: { send: true, value: null } },
    };

    expect(
      normalizePromptPresetPackage(createPromptPresetPackage(preset, exportedAt))?.parameters
        ?.customParameters,
    ).toEqual({ nullable_feature: { send: true, value: null } });
  });

  it("round-trips canonical stop values without rewriting them", () => {
    const preset = parameterPreset();
    preset.parameters = {
      ...preset.parameters,
      stopSequences: { send: true, value: ["END", "STOP"] },
    };

    expect(
      normalizePromptPresetPackage(createPromptPresetPackage(preset, exportedAt))?.parameters
        ?.stopSequences,
    ).toEqual({ send: true, value: ["END", "STOP"] });
  });

  it.each([
    ["JSON-string standard entry", { temperature: '{"send":true,"value":0.7}' }],
    ["noncanonical stop value", { stopSequences: { send: true, value: ["  END  "] } }],
  ])("rejects %s", (_label, changedParameters) => {
    const packageValue = createPromptPresetPackage(parameterPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: {
            ...packageValue.data.preset,
            parameters: { ...packageValue.data.preset.parameters, ...changedParameters },
          },
        },
      }),
    ).toBeNull();
  });

  it.each([
    ["unknown parameter", { unknown_parameter: { send: true, value: 1 } }],
    ["removed scalar parameter", { max_tokens: 2048 }],
    ["extra entry member", { temperature: { send: true, value: 0.7, enabled: true } }],
    ["constructor parameter", Object.fromEntries([["constructor", { send: true, value: 1 }]])],
    ["toString parameter", Object.fromEntries([["toString", { send: true, value: 1 }]])],
    ["__proto__ parameter", Object.fromEntries([["__proto__", { send: true, value: 1 }]])],
  ])("rejects %s instead of silently dropping it", (_label, parameters) => {
    const packageValue = createPromptPresetPackage(parameterPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: { ...packageValue.data.preset, parameters },
        },
      }),
    ).toBeNull();
  });

  it("rejects the removed duplicate sampling source of truth", () => {
    const packageValue = createPromptPresetPackage(parameterPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: {
            ...packageValue.data.preset,
            sampling: { maxTokens: 1024, temperature: 0.4 },
          },
        },
      }),
    ).toBeNull();
  });

  it.each([
    ["reasoning effort", "reasoningEffort", "maximum"],
    ["verbosity", "verbosity", "verbose"],
    ["service tier", "serviceTier", "premium"],
  ])("rejects an invalid %s enum", (_label, field, value) => {
    const packageValue = createPromptPresetPackage(parameterPreset(), exportedAt);
    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: {
            ...packageValue.data.preset,
            parameters: {
              ...packageValue.data.preset.parameters,
              [field]: { send: true, value },
            },
          },
        },
      }),
    ).toBeNull();
  });

  it.each([
    ["malformed custom JSON", "{not-json"],
    ["protected custom key", { messages: { send: true, value: [] } }],
    [
      "custom keys that collide after trimming",
      {
        foo: { send: true, value: "first" },
        " foo": { send: true, value: "second" },
      },
    ],
    [
      "unsafe nested key",
      { safe_name: { send: true, value: { nested: { constructor: "blocked" } } } },
    ],
    ["unsafe nested value", { safe_name: { send: true, value: Number.POSITIVE_INFINITY } }],
  ])("rejects %s", (_label, customParameters) => {
    const packageValue = createPromptPresetPackage(parameterPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: {
            ...packageValue.data.preset,
            parameters: { ...packageValue.data.preset.parameters, customParameters },
          },
        },
      }),
    ).toBeNull();
  });

  it.each([
    "clientSecret",
    "secretKey",
    "secret_key",
    "privateKey",
    "private_key",
    "accessKey",
    "access_key",
  ])("refuses to export credential-like custom field %s without echoing its value", (name) => {
    const preset = parameterPreset();
    const secretValue = `do-not-export-${name}`;
    preset.parameters = {
      ...preset.parameters,
      customParameters: { [name]: { send: false, value: secretValue } },
    };

    expect(() => createPromptPresetPackage(preset, exportedAt)).toThrowError(
      expect.objectContaining({ message: expect.not.stringContaining(secretValue) }),
    );
  });
});
