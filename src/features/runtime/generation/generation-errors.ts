function asErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  const message = String(error ?? "").trim();
  return message || fallback;
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

export function formatGenerationFailureNotice(
  error: unknown,
  fallback: string,
) {
  const rawMessage = asErrorMessage(error, fallback);
  const detail = stripGenerationFailurePrefix(rawMessage);
  const normalized = detail.toLowerCase();

  if (!detail) return fallback;

  if (
    normalized.includes("desktop key store") ||
    normalized.includes("not available in browser mode")
  ) {
    return "Provider API keys are only available in the desktop app. Open DeKoi desktop or choose a connection that does not require a key.";
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    const keyDetail =
      normalized.includes("invalid_api_key") || /http\s+(401|403)/i.test(detail)
        ? detail
        : "";
    return withDetail(
      "Provider API key is missing or was rejected. Open Connections, re-enter the key, then try again.",
      keyDetail,
    );
  }

  if (normalized.includes("base url")) {
    return withDetail(
      "Provider Base URL is missing or invalid. Open Connections and check the Base URL.",
      detail,
    );
  }

  if (isModelConfigurationError(normalized)) {
    return withDetail(
      "Provider model is missing or unavailable. Open Connections and check the selected model.",
      detail,
    );
  }

  if (
    normalized.includes("not supported") ||
    normalized.includes("bare-minimum provider adapter")
  ) {
    return withDetail(
      "This provider is not supported for generation yet. Choose another connection or use Mock generation.",
      detail,
    );
  }

  if (
    normalized.includes("provider request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network")
  ) {
    return withDetail(
      "Provider could not be reached. Check the Base URL and your network, then try again.",
      detail,
    );
  }

  if (/http\s+\d{3}/i.test(detail)) {
    return withDetail(
      "Provider request failed. Check the connection in Connections, then try again.",
      detail,
    );
  }

  return detail;
}
