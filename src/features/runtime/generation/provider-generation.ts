import type {
  GeneratedMessageDraft,
  GenerationPromptMessage,
  GenerationProviderKind,
  GenerationRequestBase,
  GenerationResponse,
} from "../../../engine/generation/generation";
import {
  getProviderConnectionProviderOption,
  type ProviderConnectionProvider,
} from "../../../engine/contracts/types/provider-connection";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { invokeDesktopRuntime } from "../../../shared/api/desktop-runtime";
import { RUNTIME_COMMANDS } from "../../../shared/api/runtime-commands";

type ProviderJson = Record<string, unknown>;
type ProviderTextResult = {
  text: string;
  warning?: string;
};

export type ProviderGenerationRequest = GenerationRequestBase;

function isRecord(value: unknown): value is ProviderJson {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isProviderKind(value: unknown): value is GenerationProviderKind {
  return value === "remote-runtime" || value === "external-provider";
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

export function normalizeProviderResponse(
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

  const providerKind = isProviderKind(value.providerKind)
    ? value.providerKind
    : "external-provider";
  const createdAt = readString(value.createdAt) || new Date().toISOString();
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map(normalizeDraft)
        .filter((message): message is GeneratedMessageDraft => message !== null)
    : [];

  return {
    schemaVersion: 1,
    requestId: requestId || request.id,
    providerKind,
    createdAt,
    messages,
    warnings: normalizeWarnings(value.warnings),
  };
}

export function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown provider error.");
}

function assertProviderConnection(request: ProviderGenerationRequest) {
  const connection = request.providerConnection;
  if (!connection || connection.kind !== "remote-runtime") {
    throw new Error("Generation needs a configured provider connection.");
  }

  if (!connection.model.trim()) {
    throw new Error("Provider connection needs a model before it can generate.");
  }

  if (!connection.baseUrl.trim()) {
    throw new Error("Provider connection needs a base URL before it can generate.");
  }

  const providerOption = getProviderConnectionProviderOption(connection.provider);
  if (providerOption.apiKeyRequired && !isDesktopHostAvailable()) {
    throw new Error(
      "Provider API keys are stored in the desktop key store and are not available in browser mode.",
    );
  }

  return connection;
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

function authHeaders(provider: ProviderConnectionProvider, apiKey: string) {
  const trimmedKey = apiKey.trim();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (!trimmedKey) return headers;

  if (provider === "anthropic") {
    headers["x-api-key"] = trimmedKey;
    headers["anthropic-version"] = "2023-06-01";
    return headers;
  }

  if (provider === "google") {
    headers["x-goog-api-key"] = trimmedKey;
    return headers;
  }

  headers.Authorization = `Bearer ${trimmedKey}`;
  return headers;
}

function openAiCompatibleProviders(provider: ProviderConnectionProvider) {
  return (
    provider === "openai" ||
    provider === "mistral" ||
    provider === "cohere" ||
    provider === "openrouter" ||
    provider === "nanogpt" ||
    provider === "xai" ||
    provider === "custom"
  );
}

function providerPayloadErrorMessage(payload: unknown) {
  if (!isRecord(payload) || !("error" in payload)) return "";

  if (typeof payload.error === "string") return payload.error.trim();
  if (!isRecord(payload.error)) return "Provider returned an error response.";

  return (
    readString(payload.error.message) ||
    readString(payload.error.detail) ||
    readString(payload.error.type) ||
    readString(payload.error.code) ||
    "Provider returned an error response."
  ).trim();
}

async function postJson(url: string, headers: Record<string, string>, body: ProviderJson) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  const payloadError = providerPayloadErrorMessage(payload);

  if (!response.ok) {
    const message =
      payloadError ||
      (isRecord(payload) ? readString(payload.message) || readString(payload.error) : "");
    throw new Error(message || `Provider returned HTTP ${response.status}.`);
  }

  if (payloadError) {
    throw new Error(payloadError);
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
      .filter(Boolean)
      .join("\n");
  }

  if (isRecord(value)) {
    return (
      firstText(value.text) ||
      firstText(value.output_text) ||
      firstText(value.response_text) ||
      firstText(value.generated_text) ||
      firstText(value.content) ||
      firstText(value.parts) ||
      firstText(value.message) ||
      firstText(value.response) ||
      firstText(value.generation) ||
      firstText(value.completion) ||
      firstText(value.result) ||
      firstText(value.results) ||
      firstText(value.value)
    );
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

  return (
    firstText(payload.message) ||
    firstText(payload.response) ||
    firstText(payload.response_text) ||
    firstText(payload.output_text) ||
    firstText(payload.output) ||
    firstText(payload.generated_text) ||
    firstText(payload.generation) ||
    firstText(payload.completion) ||
    firstText(payload.result) ||
    firstText(payload.results) ||
    firstText(payload.content) ||
    firstText(payload.text) ||
    firstText(payload.data)
  ).trim();
}

function emptyProviderWarning(payload: unknown) {
  return `Provider returned no text (${responseShape(payload)}).`;
}

function openAiText(payload: unknown): ProviderTextResult {
  if (!isRecord(payload)) {
    return { text: "", warning: emptyProviderWarning(payload) };
  }

  const responseText = genericProviderText(payload);
  if (responseText.trim()) return { text: responseText.trim() };

  if (!Array.isArray(payload.choices)) {
    return { text: "", warning: emptyProviderWarning(payload) };
  }

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

function anthropicText(payload: unknown): ProviderTextResult {
  if (!isRecord(payload)) {
    return { text: "", warning: emptyProviderWarning(payload) };
  }
  const text = genericProviderText(payload);
  if (text) return { text };

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
      providerKind: "external-provider",
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
      providerKind: "external-provider",
      createdAt: new Date().toISOString(),
      messages: [],
      warnings: [result.warning ?? "Provider returned no text."],
    };
  }

  return {
    schemaVersion: 1,
    requestId: request.id,
    providerKind: "external-provider",
    createdAt: new Date().toISOString(),
    messages: [{ characterId: targetCharacterId, body: strippedBody }],
    warnings: [],
  };
}

function nonSystemMessages(messages: GenerationPromptMessage[]) {
  return messages.filter((message) => message.role !== "system");
}

function systemPrompt(messages: GenerationPromptMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
}

export async function generateWithBrowserProvider(
  request: ProviderGenerationRequest,
): Promise<GenerationResponse> {
  const connection = assertProviderConnection(request);
  const headers = authHeaders(connection.provider, "");
  const { maxTokens, temperature, topP } = request.parameters;

  if (!request.targetCharacterId) {
    return createProviderResponse(request, { text: "" });
  }

  if (openAiCompatibleProviders(connection.provider)) {
    const payload = await postJson(
      appendOpenAiChatCompletionsEndpoint(connection.baseUrl),
      headers,
      {
        model: connection.model,
        messages: request.promptMessages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
      },
    );
    return createProviderResponse(request, openAiText(payload));
  }

  if (connection.provider === "anthropic") {
    const payload = await postJson(appendEndpoint(connection.baseUrl, "/messages"), headers, {
      model: connection.model,
      system: systemPrompt(request.promptMessages),
      messages: nonSystemMessages(request.promptMessages),
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    });
    return createProviderResponse(request, anthropicText(payload));
  }

  if (connection.provider === "google") {
    const baseUrl = connection.baseUrl.trim().replace(/\/+$/, "");
    const model = connection.model.replace(/^models\//, "");
    const payload = await postJson(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      headers,
      {
        systemInstruction: {
          parts: [{ text: systemPrompt(request.promptMessages) }],
        },
        contents: nonSystemMessages(request.promptMessages).map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature,
          topP,
          maxOutputTokens: maxTokens,
        },
      },
    );
    return createProviderResponse(request, googleText(payload));
  }

  throw new Error(
    `${connection.provider} is not supported by the bare-minimum provider adapter yet.`,
  );
}

export async function generateWithConfiguredProvider(
  request: ProviderGenerationRequest,
): Promise<GenerationResponse> {
  if (isDesktopHostAvailable()) {
    const connection = assertProviderConnection(request);
    const providerOption = getProviderConnectionProviderOption(connection.provider);
    if (providerOption.apiKeyRequired && connection.status !== "ready") {
      throw new Error("Provider connection needs an API key before it can generate.");
    }

    const response = await invokeDesktopRuntime<unknown>(RUNTIME_COMMANDS.generationGenerate, {
      request,
    });
    return normalizeProviderResponse(response, request);
  }

  return await generateWithBrowserProvider(request);
}
