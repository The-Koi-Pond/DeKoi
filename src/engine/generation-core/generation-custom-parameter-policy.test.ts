import { describe, expect, it } from "vitest";

import protectedCustomParameterNames from "../../../test-fixtures/protected-custom-parameter-names.json";
import protectedCredentialCustomParameterNames from "../../../test-fixtures/protected-credential-custom-parameter-names.json";

import {
  PROTECTED_CREDENTIAL_CUSTOM_PARAMETER_NAMES,
  PROTECTED_CUSTOM_PARAMETER_NAMES,
  validateGenerationCustomParameter,
  validateGenerationCustomParameters,
  validateGenerationCustomParameterValue,
} from "./generation-custom-parameter-policy";
import { normalizePromptPresetParameters } from "../prompt-presets/prompt-preset-normalization";

describe("generation custom parameter policy", () => {
  it("matches the canonical protected-name roster exactly", () => {
    expect([...PROTECTED_CUSTOM_PARAMETER_NAMES].sort()).toEqual(protectedCustomParameterNames);
  });

  it("matches the canonical credential-name roster exactly", () => {
    expect([...PROTECTED_CREDENTIAL_CUSTOM_PARAMETER_NAMES].sort()).toEqual(
      protectedCredentialCustomParameterNames,
    );
  });

  it("accepts recursively JSON-safe custom values", () => {
    expect(
      validateGenerationCustomParameter("repetition_penalty", {
        enabled: false,
        scales: [0, 1.1, null],
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    "messages",
    "maxTokens",
    "max_tokens",
    "max_completion_tokens",
    "maxOutputTokens",
    "generationConfig",
    "contents",
    "system_instruction",
    "output_config",
    "thinking",
    "route",
    "x-api-key",
    "access_token",
    "cookie",
    "authorization",
  ])("rejects protected top-level name %s without echoing a value", (name) => {
    const result = validateGenerationCustomParameter(name, "sensitive-value");

    expect(result).toEqual({ valid: false, reason: "protected-name" });
    expect(JSON.stringify(result)).not.toContain("sensitive-value");
  });

  it.each([
    "secret",
    "password",
    "passwd",
    "clientSecret",
    "client_secret",
    "secretKey",
    "secret_key",
    "privateKey",
    "private_key",
    "accessKey",
    "access_key",
    "providerSecret",
    "provider_key",
    "credentials",
  ])("rejects credential-like custom name %s", (name) => {
    expect(validateGenerationCustomParameter(name, "do-not-export")).toEqual({
      valid: false,
      reason: "protected-name",
    });
  });

  it.each(["api-key", "access-token", "secret-key", "client-secret"])(
    "rejects credential separator variant %s without echoing its value",
    (name) => {
      const result = validateGenerationCustomParameter(name, "separator-sensitive-value");

      expect(result).toEqual({ valid: false, reason: "protected-name" });
      expect(JSON.stringify(result)).not.toContain("separator-sensitive-value");
    },
  );

  it.each(["password", "api-key", "access_token", "clientSecret"])(
    "rejects nested credential-like name %s without echoing its value",
    (name) => {
      const result = validateGenerationCustomParameter("safe_container", {
        providerOptions: { [name]: "nested-sensitive-value" },
      });

      expect(result).toEqual({ valid: false, reason: "unsafe-value" });
      expect(JSON.stringify(result)).not.toContain("nested-sensitive-value");
    },
  );

  it("allows top-level request-reserved names inside non-secret nested structures", () => {
    expect(
      validateGenerationCustomParameter("safe_container", {
        provider: { model: "provider-model" },
        messages: [],
        parameters: { temperature: 0.5 },
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    "id",
    "requestId",
    "schemaVersion",
    "createdAt",
    "source",
    "provider",
    "providerConnection",
    "providerConnectionId",
    "model",
    "endpoint",
    "baseUrl",
    "url",
    "auth",
    "authentication",
    "authorization",
    "bearer",
    "basic",
    "token",
    "accessToken",
    "apiKey",
    "headers",
    "cookie",
    "set-cookie",
    "host",
    "user-agent",
    "content-type",
    "accept",
    "organization",
    "project",
    "messages",
    "message",
    "promptMessages",
    "prompt",
    "input",
    "parameters",
    "thread",
    "companions",
    "activePersona",
    "lorebooks",
    "warnings",
    "stream",
    "tools",
    "toolChoice",
    "responseFormat",
    "targetCharacterId",
    "targetCharacterName",
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
    "customParameters",
    "max_tokens",
    "max_completion_tokens",
    "maxoutputtokens",
    "generationconfig",
    "contents",
    "system",
    "systeminstruction",
    "system_instruction",
    "output_config",
    "thinking",
    "thinkingconfig",
    "models",
    "route",
    "routing",
    "provider_routing",
    "x-api-key",
    "x-goog-api-key",
    "anthropic-version",
    "access_token",
    "api_key",
    "base_url",
    "provider_connection_id",
    "prompt_messages",
    "request_id",
    "schema_version",
    "target_character_id",
    "target_character_name",
    "tool_choice",
    "response_format",
    "top_p",
    "top_k",
    "min_p",
    "frequency_penalty",
    "presence_penalty",
    "reasoning_effort",
    "service_tier",
    "stop",
    "stop_sequences",
  ])("rejects every protected name case-insensitively: %s", (name) => {
    expect(validateGenerationCustomParameter(name.toUpperCase(), true)).toEqual({
      valid: false,
      reason: "protected-name",
    });
  });

  it("rejects noncanonical whitespace instead of silently collapsing names", () => {
    expect(validateGenerationCustomParameter("  repetition_penalty  ", true)).toEqual({
      valid: false,
      reason: "invalid-name",
    });
    expect(validateGenerationCustomParameter("   ", true)).toEqual({
      valid: false,
      reason: "invalid-name",
    });
  });

  it.each([
    { unsafe: { constructor: "blocked" } },
    { unsafe: Number.POSITIVE_INFINITY },
    { unsafe: undefined },
  ])("rejects unsafe nested keys and values", ({ unsafe }) => {
    expect(validateGenerationCustomParameterValue({ nested: unsafe })).toBe(false);
  });

  it("rejects custom values that exceed bounded nesting, entry, or serialized-size limits", () => {
    let deeplyNested: unknown = true;
    for (let depth = 0; depth < 20; depth += 1) deeplyNested = { nested: deeplyNested };

    expect(validateGenerationCustomParameterValue(deeplyNested)).toBe(false);
    expect(validateGenerationCustomParameterValue(new Array(1_100).fill(false))).toBe(false);
    expect(validateGenerationCustomParameterValue("x".repeat(70_000))).toBe(false);
  });

  it("enforces aggregate entry, name, and UTF-8 byte limits across the custom object", () => {
    const tooManyAggregateEntries = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [`field_${index}`, { nested: false }]),
    );

    expect(validateGenerationCustomParameters(tooManyAggregateEntries)).toBe(false);
    expect(validateGenerationCustomParameters({ ["x".repeat(129)]: false })).toBe(false);
    expect(validateGenerationCustomParameters({ unicode: "鯉".repeat(22_000) })).toBe(false);
    expect(validateGenerationCustomParameters({ unicode: "鯉" })).toBe(true);
  });

  it("omits invalid native entries while preserving valid tombstones and empty values", () => {
    expect(
      normalizePromptPresetParameters({
        reasoningEffort: { send: true, value: "maximum" },
        temperature: { send: false, value: null },
        stopSequences: { send: true, value: [] },
        customParameters: {
          messages: { send: true, value: [] },
          unsafe: { send: true, value: { constructor: "blocked" } },
          safe: { send: false, value: false },
          " safe": { send: true, value: true },
        },
      }),
    ).toEqual({
      temperature: { send: false, value: null },
      stopSequences: { send: true, value: [] },
      customParameters: { safe: { send: false, value: false } },
    });
  });

  it("preserves disabled numeric drafts and sent custom null values", () => {
    expect(
      normalizePromptPresetParameters({
        temperature: { send: false, value: 3 },
        customParameters: { nullable_feature: { send: true, value: null } },
      }),
    ).toEqual({
      temperature: { send: false, value: 3 },
      customParameters: { nullable_feature: { send: true, value: null } },
    });
  });

  it("drops invalid sent numeric values instead of clamping them", () => {
    expect(
      normalizePromptPresetParameters({
        temperature: { send: true, value: 3 },
        maxTokens: { send: true, value: 1.5 },
      }),
    ).toBeNull();
  });

  it("omits an aggregate-invalid custom parameter object during normalization", () => {
    const customParameters = Object.fromEntries(
      Array.from({ length: 600 }, (_, index) => [
        `field_${index}`,
        { send: true, value: { nested: false } },
      ]),
    );

    expect(normalizePromptPresetParameters({ customParameters })).toBeNull();
  });
});
