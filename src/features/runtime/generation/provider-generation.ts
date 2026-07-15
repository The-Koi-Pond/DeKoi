import type {
  GeneratedMessageDraft,
  GenerationRequestBase,
  GenerationResponse,
  GenerationResponseSource,
} from "../../../engine/generation/generation";
import {
  getProviderConnectionProviderOption,
  type ProviderConnectionProvider,
} from "../../../engine/contracts/types/provider-connection";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { fetchJsonWithTimeout, formatTimeoutDuration } from "../../../shared/api/http-timeout";
import { invokeProviderGeneration } from "../../../shared/api/provider-generation";
import { buildProviderPayloadForPlan } from "./provider-parameter-adaptation";
import {
  resolveProviderTransportPlan,
  type ProviderTransportPlan,
} from "./provider-transport-plan";

type ProviderJson = Record<string, unknown>;
export type ProviderTextResult = {
  text: string;
  warning?: string;
};

export type ProviderGenerationRequest = GenerationRequestBase;

const PROVIDER_GENERATION_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is ProviderJson {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isGenerationResponseSource(value: unknown): value is GenerationResponseSource {
  return value === "remote-runtime" || value === "provider-transport";
}

function normalizeDraft(value: unknown): GeneratedMessageDraft | null {
  if (!isRecord(value)) return null;

  const characterId = readString(value.characterId).trim();
  const body = readString(value.body).trim();
  if (!characterId || !body) return null;

  return { characterId, body };
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (warning): warning is string => typeof warning === "string" && warning.trim().length > 0,
  );
}

function normalizeProviderResponse(
  value: unknown,
  request: ProviderGenerationRequest,
): GenerationResponse {
  if (!isRecord(value)) {
    throw new Error("Provider returned an invalid generation response.");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("Provider returned an unsupported generation schema.");
  }

  const requestId = readString(value.requestId);
  if (requestId && requestId !== request.id) {
    throw new Error("Provider returned a response for a different request.");
  }

  if (!isGenerationResponseSource(value.source)) {
    throw new Error("Provider returned an unsupported generation response source.");
  }

  const createdAt = readString(value.createdAt) || new Date().toISOString();
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map(normalizeDraft)
        .filter((message): message is GeneratedMessageDraft => message !== null)
    : [];

  return {
    schemaVersion: 1,
    requestId: requestId || request.id,
    source: value.source,
    createdAt,
    messages,
    warnings: normalizeWarnings(value.warnings),
  };
}

export function providerErrorMessage(error: unknown) {
  const detail =
    error instanceof Error ? error.message : String(error || "Unknown provider error.");
  return cleanProviderErrorDetail(detail);
}

const MAX_PROVIDER_ERROR_DETAIL_LENGTH = 300;
const PROVIDER_CREDENTIAL_FIELD_PATTERN =
  /(["']?)((?:api[_-]?key|x-api-key|x-goog-api-key|access[_-]?token|token))\1\s*([:=])\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi;

function cleanProviderErrorDetail(detail: string) {
  const cleaned = detail
    .replace(/\b(Authorization\s*[:=]\s*)?(?:Bearer|Basic)\s+[^\s,;]+/gi, "$1[redacted]")
    .replace(PROVIDER_CREDENTIAL_FIELD_PATTERN, "$1$2$1$3[redacted]")
    .replace(/\b(?:sk-[A-Za-z0-9._-]{4,}|AIza[A-Za-z0-9_-]{8,})/g, "[redacted]")
    .replace(/(https?:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi, "$1[redacted]@")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Unknown provider error.";
  return cleaned.slice(0, MAX_PROVIDER_ERROR_DETAIL_LENGTH);
}

function assertProviderConnection(request: ProviderGenerationRequest) {
  const connection = request.providerConnection;
  if (!connection || connection.kind !== "provider") {
    throw new Error("Generation needs a configured provider connection.");
  }

  if (!connection.model.trim()) {
    throw new Error("Provider connection needs a model before it can generate.");
  }

  if (!connection.baseUrl.trim()) {
    throw new Error("Provider connection needs a base URL before it can generate.");
  }

  return connection;
}

function assertBrowserProviderAccess(provider: ProviderConnectionProvider) {
  if (getProviderConnectionProviderOption(provider).apiKeyRequired) {
    throw new Error(
      "Provider API keys are stored in the desktop key store and are not available in browser mode.",
    );
  }
}

function appendEndpoint(baseUrl: string, endpoint: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith(endpoint) ? trimmed : `${trimmed}${endpoint}`;
}

function appendOpenAiChatCompletionsEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (/\/(?:v\d+|api\/v\d+)$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

function browserHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function providerPayloadErrorMessage(payload: unknown) {
  if (!isRecord(payload) || !("error" in payload)) return "";

  if (typeof payload.error === "string") return payload.error.trim();
  if (!isRecord(payload.error)) return "Provider returned an error response.";

  const message = (
    readString(payload.error.message) ||
    readString(payload.error.detail) ||
    readString(payload.error.type) ||
    "Provider returned an error response."
  ).trim();
  const code = readString(payload.error.code).trim();
  return code && code !== message ? `${message} (${code})` : message;
}

async function postJson(url: string, headers: Record<string, string>, body: ProviderJson) {
  let response: Response;
  let payload: unknown;
  try {
    ({ response, body: payload } = await fetchJsonWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      PROVIDER_GENERATION_TIMEOUT_MS,
      `Provider request timed out after ${formatTimeoutDuration(PROVIDER_GENERATION_TIMEOUT_MS)}.`,
    ));
  } catch (error) {
    throw new Error(providerErrorMessage(error), { cause: error });
  }
  const payloadError = providerPayloadErrorMessage(payload);

  if (!response.ok) {
    const message =
      payloadError ||
      (isRecord(payload) ? readString(payload.message) || readString(payload.error) : "");
    throw new Error(
      cleanProviderErrorDetail(message || `Provider returned HTTP ${response.status}.`),
    );
  }

  if (payloadError) {
    throw new Error(cleanProviderErrorDetail(payloadError));
  }

  return payload;
}

function responseShape(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (!isRecord(value)) return typeof value;

  const keys = Object.keys(value);
  if (keys.length === 0) return "object(no fields)";

  const visibleKeys = keys.slice(0, 8).join(", ");
  return keys.length > 8 ? `fields: ${visibleKeys}, ...` : `fields: ${visibleKeys}`;
}

function firstText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => firstText(item))
      .filter((text) => text.trim().length > 0)
      .join("\n");
  }

  if (isRecord(value)) {
    for (const key of [
      "text",
      "output_text",
      "response_text",
      "generated_text",
      "content",
      "parts",
      "message",
      "response",
      "generation",
      "completion",
      "result",
      "results",
      "value",
    ]) {
      const text = firstText(value[key]);
      if (text.trim()) return text;
    }
  }

  return "";
}

function firstRefusal(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const refusal = firstRefusal(item);
      if (refusal) return refusal;
    }
    return "";
  }

  if (isRecord(value)) {
    const direct =
      typeof value.refusal === "string" ? value.refusal.trim() : firstText(value.refusal).trim();
    if (direct) return direct;

    for (const key of ["content", "parts", "message", "response", "output", "results", "data"]) {
      const refusal = firstRefusal(value[key]);
      if (refusal) return refusal;
    }
  }

  return "";
}

function genericProviderText(payload: unknown) {
  if (!isRecord(payload)) return firstText(payload).trim();

  for (const key of [
    "message",
    "response",
    "response_text",
    "output_text",
    "output",
    "generated_text",
    "generation",
    "completion",
    "result",
    "results",
    "content",
    "text",
    "data",
  ]) {
    const text = firstText(payload[key]).trim();
    if (text) return text;
  }

  return firstText(payload).trim();
}

function emptyProviderWarning(payload: unknown) {
  return `Provider returned no text (${responseShape(payload)}).`;
}

function openAiText(payload: unknown): ProviderTextResult {
  if (isRecord(payload) && Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      if (!isRecord(choice)) continue;

      const text = isRecord(choice.message)
        ? firstText(choice.message.content)
        : firstText(choice.text);
      if (text.trim()) return { text: text.trim() };
    }

    const firstChoice = payload.choices.find(isRecord);
    const refusal = firstChoice ? firstRefusal(firstChoice) : "";
    if (refusal) return { text: "", warning: `Provider refused the reply: ${refusal}` };

    const finishReason = firstChoice ? readString(firstChoice.finish_reason).trim() : "";
    return {
      text: "",
      warning: finishReason
        ? `Provider returned no text (finish reason: ${finishReason}).`
        : emptyProviderWarning(payload),
    };
  }

  const responseText = genericProviderText(payload);
  if (responseText.trim()) return { text: responseText.trim() };
  return { text: "", warning: emptyProviderWarning(payload) };
}

function anthropicText(payload: unknown): ProviderTextResult {
  const text = genericProviderText(payload);
  if (text) return { text };

  if (!isRecord(payload)) {
    return { text: "", warning: emptyProviderWarning(payload) };
  }

  const stopReason = readString(payload.stop_reason).trim();
  return {
    text: "",
    warning: stopReason
      ? `Provider returned no text (stop reason: ${stopReason}).`
      : emptyProviderWarning(payload),
  };
}

function googleText(payload: unknown): ProviderTextResult {
  if (!isRecord(payload)) {
    return { text: "", warning: emptyProviderWarning(payload) };
  }

  if (!Array.isArray(payload.candidates)) {
    const text = genericProviderText(payload);
    if (text) return { text };

    const promptFeedback = isRecord(payload.promptFeedback) ? payload.promptFeedback : null;
    const blockReason = promptFeedback ? readString(promptFeedback.blockReason).trim() : "";
    return {
      text: "",
      warning: blockReason
        ? `Provider blocked the prompt (${blockReason}).`
        : emptyProviderWarning(payload),
    };
  }

  for (const candidate of payload.candidates) {
    if (!isRecord(candidate)) continue;
    const text = firstText(candidate.content).trim();
    if (text) return { text };
  }

  const firstCandidate = payload.candidates.find(isRecord);
  const finishReason = firstCandidate ? readString(firstCandidate.finishReason).trim() : "";
  return {
    text: "",
    warning: finishReason
      ? `Provider returned no text (finish reason: ${finishReason}).`
      : emptyProviderWarning(payload),
  };
}

export function extractProviderTextResult(
  provider: ProviderConnectionProvider,
  payload: unknown,
): ProviderTextResult {
  const plan = resolveProviderTransportPlan(provider);
  if (plan) return extractProviderTextResultForPlan(plan, payload);

  throw new Error(`${provider} is not supported by the bare-minimum provider adapter yet.`);
}

function extractProviderTextResultForPlan(
  plan: ProviderTransportPlan,
  payload: unknown,
): ProviderTextResult {
  if (plan.responseKind === "openai") return openAiText(payload);
  if (plan.responseKind === "anthropic") return anthropicText(payload);
  return googleText(payload);
}

function stripSpeakerPrefix(body: string, speakerName: string | null) {
  const trimmed = body.trim();
  if (!speakerName) return trimmed;

  const escaped = speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return trimmed.replace(new RegExp(`^${escaped}\\s*:\\s*`, "i"), "").trim();
}

function createProviderResponse(
  request: ProviderGenerationRequest,
  result: ProviderTextResult,
): GenerationResponse {
  const targetCharacterId = request.targetCharacterId;
  if (!targetCharacterId) {
    return {
      schemaVersion: 1,
      requestId: request.id,
      source: "provider-transport",
      createdAt: new Date().toISOString(),
      messages: [],
      warnings: ["No companion is available for this generation request."],
    };
  }

  const strippedBody = stripSpeakerPrefix(result.text, request.targetCharacterName);
  if (!strippedBody) {
    return {
      schemaVersion: 1,
      requestId: request.id,
      source: "provider-transport",
      createdAt: new Date().toISOString(),
      messages: [],
      warnings: [result.warning ?? "Provider returned no text."],
    };
  }

  return {
    schemaVersion: 1,
    requestId: request.id,
    source: "provider-transport",
    createdAt: new Date().toISOString(),
    messages: [{ characterId: targetCharacterId, body: strippedBody }],
    warnings: [],
  };
}

async function generateWithBrowserProvider(
  request: ProviderGenerationRequest,
  payload: ProviderJson,
  plan: ProviderTransportPlan,
): Promise<GenerationResponse> {
  const connection = assertProviderConnection(request);
  assertBrowserProviderAccess(connection.provider);

  if (!request.targetCharacterId) {
    return createProviderResponse(request, { text: "" });
  }

  let endpoint: string;
  if (plan.endpointKind === "openai") {
    endpoint = appendOpenAiChatCompletionsEndpoint(connection.baseUrl);
  } else if (plan.endpointKind === "anthropic") {
    endpoint = appendEndpoint(connection.baseUrl, "/messages");
  } else {
    const baseUrl = connection.baseUrl.trim().replace(/\/+$/, "");
    const model = connection.model.replace(/^models\//, "");
    endpoint = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  }
  const responsePayload = await postJson(endpoint, browserHeaders(), payload);
  return createProviderResponse(request, extractProviderTextResultForPlan(plan, responsePayload));
}

export async function generateWithConfiguredProvider(
  request: ProviderGenerationRequest,
): Promise<GenerationResponse> {
  const connection = assertProviderConnection(request);
  const plan = resolveProviderTransportPlan(connection.provider);
  if (!plan) throw new Error(`${connection.provider} is not supported for generation.`);
  const payload = buildProviderPayloadForPlan(
    {
      provider: connection.provider,
      model: connection.model,
      messages: request.promptMessages,
      parameters: request.parameters,
    },
    plan,
  );

  if (isDesktopHostAvailable()) {
    const providerOption = getProviderConnectionProviderOption(connection.provider);
    if (providerOption.apiKeyRequired && connection.status !== "ready") {
      throw new Error("Provider connection needs an API key before it can generate.");
    }

    const response = await invokeProviderGeneration({
      id: request.id,
      createdAt: request.createdAt,
      targetCharacterId: request.targetCharacterId,
      targetCharacterName: request.targetCharacterName,
      connection: {
        id: connection.id,
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        model: connection.model,
        status: connection.status,
      },
      promptMessages: request.promptMessages,
      parameters: request.parameters,
    });
    return normalizeProviderResponse(response, request);
  }

  return await generateWithBrowserProvider(request, payload, plan);
}
