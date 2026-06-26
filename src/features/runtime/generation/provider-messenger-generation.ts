import type {
  MessengerGeneratedMessageDraft,
  MessengerGenerationAdapter,
  MessengerGenerationProviderKind,
  MessengerGenerationPromptMessage,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../../../engine/messenger-generation";
import type { ProviderConnectionProvider } from "../../../engine/provider-connection";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { invokeDesktopRuntime } from "../../../shared/api/desktop-runtime";
import { RUNTIME_COMMANDS } from "../../../shared/api/runtime-commands";

type ProviderJson = Record<string, unknown>;

function isRecord(value: unknown): value is ProviderJson {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isProviderKind(value: unknown): value is MessengerGenerationProviderKind {
  return (
    value === "mock" ||
    value === "remote-runtime" ||
    value === "external-provider"
  );
}

function normalizeDraft(value: unknown): MessengerGeneratedMessageDraft | null {
  if (!isRecord(value)) return null;

  const characterId = readString(value.characterId).trim();
  const body = readString(value.body).trim();
  if (!characterId || !body) return null;

  return { characterId, body };
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (warning): warning is string =>
      typeof warning === "string" && warning.trim().length > 0,
  );
}

function normalizeProviderResponse(
  value: unknown,
  request: MessengerGenerationRequest,
): MessengerGenerationResponse {
  if (!isRecord(value)) {
    throw new Error("Provider returned an invalid Messenger generation response.");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("Provider returned an unsupported Messenger generation schema.");
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
        .filter((message): message is MessengerGeneratedMessageDraft => message !== null)
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

function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown provider error.");
}

function assertProviderConnection(request: MessengerGenerationRequest) {
  const connection = request.providerConnection;
  if (!connection || connection.kind !== "remote-runtime") {
    throw new Error("Messenger generation needs a configured provider connection.");
  }

  if (!connection.model.trim()) {
    throw new Error("Provider connection needs a model before it can generate.");
  }

  if (!connection.baseUrl.trim()) {
    throw new Error("Provider connection needs a base URL before it can generate.");
  }

  return connection;
}

function appendEndpoint(baseUrl: string, endpoint: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith(endpoint) ? trimmed : `${trimmed}${endpoint}`;
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

async function postJson(url: string, headers: Record<string, string>, body: ProviderJson) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error)
        ? readString(payload.error.message)
        : isRecord(payload)
          ? readString(payload.message) || readString(payload.error)
          : "";
    throw new Error(message || `Provider returned HTTP ${response.status}.`);
  }

  return payload;
}

function firstText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item)) return readString(item.text);
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function openAiText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return "";
  const choice = payload.choices.find(isRecord);
  if (!choice) return "";
  if (isRecord(choice.message)) return firstText(choice.message.content).trim();
  return firstText(choice.text).trim();
}

function anthropicText(payload: unknown) {
  if (!isRecord(payload)) return "";
  return firstText(payload.content).trim();
}

function googleText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return "";
  const candidate = payload.candidates.find(isRecord);
  const parts = isRecord(candidate?.content) && Array.isArray(candidate.content.parts)
    ? candidate.content.parts
    : [];
  return parts
    .map((part) => (isRecord(part) ? readString(part.text) : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function stripSpeakerPrefix(body: string, speakerName: string | null) {
  const trimmed = body.trim();
  if (!speakerName) return trimmed;

  const escaped = speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return trimmed.replace(new RegExp(`^${escaped}\\s*:\\s*`, "i"), "").trim();
}

function createProviderResponse(
  request: MessengerGenerationRequest,
  body: string,
): MessengerGenerationResponse {
  const targetCharacterId = request.targetCharacterId;
  const strippedBody = stripSpeakerPrefix(body, request.targetCharacterName);
  if (!targetCharacterId || !strippedBody) {
    return {
      schemaVersion: 1,
      requestId: request.id,
      providerKind: "external-provider",
      createdAt: new Date().toISOString(),
      messages: [],
      warnings: ["Provider did not return a usable companion reply."],
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

function nonSystemMessages(messages: MessengerGenerationPromptMessage[]) {
  return messages.filter((message) => message.role !== "system");
}

function systemPrompt(messages: MessengerGenerationPromptMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
}

async function generateWithBrowserProvider(
  request: MessengerGenerationRequest,
): Promise<MessengerGenerationResponse> {
  const connection = assertProviderConnection(request);
  const headers = authHeaders(connection.provider, connection.apiKey);
  const { maxTokens, temperature, topP } = request.parameters;

  if (openAiCompatibleProviders(connection.provider)) {
    const payload = await postJson(
      appendEndpoint(connection.baseUrl, "/chat/completions"),
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
    const payload = await postJson(
      appendEndpoint(connection.baseUrl, "/messages"),
      headers,
      {
        model: connection.model,
        system: systemPrompt(request.promptMessages),
        messages: nonSystemMessages(request.promptMessages),
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
      },
    );
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
    `${connection.provider} is not supported by the bare-minimum Messenger provider adapter yet.`,
  );
}

export const providerMessengerGenerationAdapter: MessengerGenerationAdapter = {
  providerKind: "external-provider",
  async generate(request) {
    try {
      if (isDesktopHostAvailable()) {
        const response = await invokeDesktopRuntime<unknown>(
          RUNTIME_COMMANDS.messengerGenerate,
          { request },
        );
        return normalizeProviderResponse(response, request);
      }

      return await generateWithBrowserProvider(request);
    } catch (error) {
      throw new Error(`Provider Messenger generation failed. ${providerErrorMessage(error)}`, {
        cause: error,
      });
    }
  },
};
