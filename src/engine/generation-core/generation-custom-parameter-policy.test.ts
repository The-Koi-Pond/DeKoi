import { describe, expect, it } from "vitest";

import protectedCustomParameterNames from "../../../test-fixtures/protected-custom-parameter-names.json";

import {
  PROTECTED_CUSTOM_PARAMETER_NAMES,
  validateGenerationCustomParameter,
  validateGenerationCustomParameters,
  validateGenerationCustomParameterValue,
} from "./generation-custom-parameter-policy";

describe("generation custom parameter policy", () => {
  it("matches the canonical protected-name roster exactly", () => {
    expect([...PROTECTED_CUSTOM_PARAMETER_NAMES].sort()).toEqual(protectedCustomParameterNames);
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
  ])("rejects every protected name case-insensitively after trimming: %s", (name) => {
    expect(validateGenerationCustomParameter(`  ${name.toUpperCase()}  `, true)).toEqual({
      valid: false,
      reason: "protected-name",
    });
  });

  it("preserves whitespace trimming for non-protected names", () => {
    expect(validateGenerationCustomParameter("  repetition_penalty  ", true)).toEqual({
      valid: true,
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
});
