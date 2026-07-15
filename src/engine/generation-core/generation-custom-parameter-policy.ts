import type { GenerationJsonValue } from "./generation-parameter-contract";

const UNSAFE_RECORD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_CUSTOM_PARAMETER_DEPTH = 16;
const MAX_CUSTOM_PARAMETER_ENTRIES = 1_024;
const MAX_CUSTOM_PARAMETER_NAME_BYTES = 128;
const MAX_CUSTOM_PARAMETER_BYTES = 65_536;

/**
 * Names owned by DeKoi request routing, authentication, messages, or the
 * provider-neutral parameter contract cannot be shadowed by custom fields.
 */
const PROTECTED_CUSTOM_PARAMETER_NAMES = new Set(
  [
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
  ].map((name) => name.toLowerCase()),
);

export type GenerationCustomParameterValidation =
  { valid: true } | { valid: false; reason: "invalid-name" | "protected-name" | "unsafe-value" };

function isPlainRecord(value: object) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function validateCustomJsonTree(value: unknown) {
  let entries = 0;
  const ancestors = new WeakSet<object>();

  function visit(candidate: unknown, depth: number): boolean {
    if (depth > MAX_CUSTOM_PARAMETER_DEPTH || entries > MAX_CUSTOM_PARAMETER_ENTRIES) return false;
    if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") {
      return true;
    }
    if (typeof candidate === "number") return Number.isFinite(candidate);
    if (typeof candidate !== "object" || (!Array.isArray(candidate) && !isPlainRecord(candidate))) {
      return false;
    }
    if (ancestors.has(candidate)) return false;
    ancestors.add(candidate);

    const fields: [string, unknown][] = Array.isArray(candidate)
      ? candidate.map((field, index) => [String(index), field])
      : Object.entries(candidate);
    entries += fields.length;
    if (entries > MAX_CUSTOM_PARAMETER_ENTRIES) return false;

    for (const [key, fieldValue] of fields) {
      if (
        UNSAFE_RECORD_KEYS.has(key.toLowerCase()) ||
        utf8ByteLength(key) > MAX_CUSTOM_PARAMETER_NAME_BYTES ||
        !visit(fieldValue, depth + 1)
      ) {
        return false;
      }
    }

    ancestors.delete(candidate);
    return true;
  }

  return visit(value, 0);
}

function isWithinSerializedByteLimit(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return (
      typeof serialized === "string" && utf8ByteLength(serialized) <= MAX_CUSTOM_PARAMETER_BYTES
    );
  } catch {
    return false;
  }
}

export function validateGenerationCustomParameterValue(
  value: unknown,
): value is GenerationJsonValue {
  return validateCustomJsonTree(value) && isWithinSerializedByteLimit(value);
}

export function validateGenerationCustomParameters(
  value: unknown,
): value is Record<string, GenerationJsonValue> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !isPlainRecord(value)
  ) {
    return false;
  }
  for (const [name, fieldValue] of Object.entries(value)) {
    if (!validateGenerationCustomParameter(name, fieldValue).valid) return false;
  }
  return validateCustomJsonTree(value) && isWithinSerializedByteLimit(value);
}

export function validateGenerationCustomParameter(
  name: string,
  value: unknown,
): GenerationCustomParameterValidation {
  const normalized = name.trim().toLowerCase();
  if (
    !normalized ||
    UNSAFE_RECORD_KEYS.has(normalized) ||
    utf8ByteLength(name.trim()) > MAX_CUSTOM_PARAMETER_NAME_BYTES
  ) {
    return { valid: false, reason: "invalid-name" };
  }
  if (PROTECTED_CUSTOM_PARAMETER_NAMES.has(normalized)) {
    return { valid: false, reason: "protected-name" };
  }
  if (!validateGenerationCustomParameterValue(value)) {
    return { valid: false, reason: "unsafe-value" };
  }
  return { valid: true };
}
