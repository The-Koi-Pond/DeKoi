import type {
  MessengerGeneratedMessageDraft,
  MessengerGenerationAdapter,
  MessengerGenerationProviderKind,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../engine/messenger-generation";
import { invokeRemote } from "../shared/api/remote-runtime";
import { RUNTIME_COMMANDS } from "../shared/api/runtime-commands";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error ?? "Unknown generation error.");
}

function isProviderKind(value: unknown): value is MessengerGenerationProviderKind {
  return (
    value === "mock" ||
    value === "remote-runtime" ||
    value === "external-provider"
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
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

function normalizeRemoteResponse(
  value: unknown,
  request: MessengerGenerationRequest,
): MessengerGenerationResponse {
  if (!isRecord(value)) {
    throw new Error("Remote runtime returned an invalid generation response.");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("Remote runtime returned an unsupported generation schema.");
  }

  const requestId = readString(value.requestId);
  if (requestId && requestId !== request.id) {
    throw new Error("Remote runtime returned a response for a different request.");
  }

  const providerKind = isProviderKind(value.providerKind)
    ? value.providerKind
    : "remote-runtime";
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

export const remoteMessengerGenerationAdapter: MessengerGenerationAdapter = {
  providerKind: "remote-runtime",
  async generate(request) {
    try {
      const response = await invokeRemote<unknown>(
        RUNTIME_COMMANDS.messengerGenerate,
        { request },
      );
      return normalizeRemoteResponse(response, request);
    } catch (error) {
      throw new Error(
        `Remote Messenger generation failed. ${asErrorMessage(error)}`,
        { cause: error },
      );
    }
  },
};
