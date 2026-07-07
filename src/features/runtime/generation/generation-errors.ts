import { errorMessage } from "../../../shared/errors";
import type { GenerationConnectionReadinessFailureCode } from "./generation-transport";

export type GenerationFailureRecoveryTarget = "connections" | "new-connection";

export interface GenerationFailureNotice {
  message: string;
  recoveryTarget?: GenerationFailureRecoveryTarget;
}

const generationReadinessFailureMessages = {
  "missing-connection": "Create or select a connection before generating.",
  "connection-needs-key": "Add an API key to this connection before generating.",
  "missing-base-url": "Add a Base URL to this connection before generating.",
  "missing-model": "Select a model for this connection before generating.",
  "desktop-key-store-unavailable":
    "Provider API keys are only available in the desktop app. Open DeKoi desktop or choose a connection that does not require a key.",
} as const satisfies Record<GenerationConnectionReadinessFailureCode, string>;

const generationReadinessRecoveryTargets = {
  "missing-connection": "new-connection",
  "connection-needs-key": "connections",
  "missing-base-url": "connections",
  "missing-model": "connections",
  "desktop-key-store-unavailable": "connections",
} as const satisfies Record<
  GenerationConnectionReadinessFailureCode,
  GenerationFailureRecoveryTarget
>;

export function describeGenerationReadinessFailure(
  code: GenerationConnectionReadinessFailureCode,
): GenerationFailureNotice {
  return {
    message: generationReadinessFailureMessages[code],
    recoveryTarget: generationReadinessRecoveryTargets[code],
  };
}

export function formatGenerationReadinessFailure(code: GenerationConnectionReadinessFailureCode) {
  return describeGenerationReadinessFailure(code).message;
}

function stripGenerationFailurePrefix(message: string) {
  // Keep these prefixes in sync with provider-messenger-generation.ts and roleplay-generation.ts.
  return message
    .replace(/^Provider\s+(?:Messenger|Roleplay)\s+generation\s+failed\.\s*/i, "")
    .replace(/^Provider\s+generation\s+failed\.\s*/i, "")
    .trim();
}

function withDetail(message: string, detail: string) {
  return detail ? `${message} ${detail}` : message;
}

function isModelConfigurationError(normalized: string) {
  return [
    /\bmodel_not_found\b/,
    /\bmodel\b\s+(?:is\s+)?(?:missing|unavailable|invalid|unknown|unsupported)\b/,
    /\bmodel\b\s+(?:is\s+)?not\s+(?:found|available|supported)\b/,
    /\bmodel\b\s+does\s+not\s+exist\b/,
    /\b(?:missing|no such|invalid|unknown|unsupported)\s+model\b/,
    /\b(?:needs|requires)\s+(?:a\s+)?model\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function describeGenerationFailureNotice(
  error: unknown,
  fallback: string,
): GenerationFailureNotice {
  const rawMessage = errorMessage(error, fallback);
  const detail = stripGenerationFailurePrefix(rawMessage);
  const normalized = detail.toLowerCase();

  if (!detail) {
    return { message: fallback };
  }

  if (
    normalized.includes("configured provider connection") ||
    normalized.includes("requires request.providerconnection")
  ) {
    return {
      message: withDetail(
        "This thread needs a provider connection before it can generate.",
        detail,
      ),
      recoveryTarget: "new-connection",
    };
  }

  if (
    normalized.includes("desktop key store") ||
    normalized.includes("not available in browser mode")
  ) {
    return {
      message:
        "Provider API keys are only available in the desktop app. Open DeKoi desktop or choose a connection that does not require a key.",
      recoveryTarget: "connections",
    };
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    const keyDetail =
      normalized.includes("invalid_api_key") || /http\s+(401|403)/i.test(detail) ? detail : "";
    return {
      message: withDetail(
        "Provider API key is missing or was rejected. Open the connection, re-enter the key, then try again.",
        keyDetail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (normalized.includes("base url")) {
    return {
      message: withDetail(
        "Provider Base URL is missing or invalid. Open the connection and check the Base URL.",
        detail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (isModelConfigurationError(normalized)) {
    return {
      message: withDetail(
        "Provider model is missing or unavailable. Open the connection and check the selected model.",
        detail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (
    normalized.includes("not supported") ||
    normalized.includes("bare-minimum provider adapter")
  ) {
    return {
      message: withDetail(
        "This provider is not supported for generation yet. Choose another connection.",
        detail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient credits")
  ) {
    return {
      message: withDetail(
        "Provider account quota or rate limit blocked the reply. Check the provider account or try again later.",
        detail,
      ),
    };
  }

  if (
    normalized.includes("context length") ||
    normalized.includes("maximum context") ||
    normalized.includes("prompt is too long") ||
    normalized.includes("too many tokens")
  ) {
    return {
      message: withDetail(
        "Provider rejected the prompt because it is too long. Shorten the thread context or lower max tokens, then try again.",
        detail,
      ),
    };
  }

  if (normalized.includes("cors")) {
    return {
      message: withDetail(
        "Browser provider request was blocked. Use the desktop app or a provider URL that allows this app.",
        detail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (
    normalized.includes("provider request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network")
  ) {
    return {
      message: withDetail(
        "Provider could not be reached. Check the Base URL and your network, then try again.",
        detail,
      ),
      recoveryTarget: "connections",
    };
  }

  if (/http\s+\d{3}/i.test(detail)) {
    return {
      message: withDetail("Provider request failed. Check the connection, then try again.", detail),
      recoveryTarget: "connections",
    };
  }

  if (normalized.includes("provider refused")) {
    return {
      message: withDetail("Provider refused to generate a reply.", detail),
    };
  }

  if (normalized.includes("provider blocked the prompt")) {
    return {
      message: withDetail("Provider blocked the prompt.", detail),
    };
  }

  if (normalized.includes("provider returned no text")) {
    return {
      message: withDetail("Provider did not return text for this reply.", detail),
    };
  }

  return { message: detail };
}
