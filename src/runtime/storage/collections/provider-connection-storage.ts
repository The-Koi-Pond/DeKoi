import {
  getProviderConnectionProviderOption,
  normalizeProviderConnectionProvider,
  providerConnections,
  sanitizeProviderConnectionRecord,
  type ProviderConnectionKind,
  type ProviderConnectionProvider,
  type ProviderConnectionRecord,
  type ProviderConnectionStatus,
} from "../../../engine/provider-connection";
import {
  isRecord,
  readNullableString,
  readString,
  readTimestamp,
} from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

function normalizeConnectionKind(value: unknown): ProviderConnectionKind {
  return value === "remote-runtime" ? "remote-runtime" : "mock";
}

function normalizeConnectionProvider(
  value: unknown,
  kind: ProviderConnectionKind,
) {
  return normalizeProviderConnectionProvider(
    value,
    kind === "remote-runtime" ? "openai" : "custom",
  );
}

function normalizeConnectionStatus(
  value: unknown,
  provider: ProviderConnectionProvider,
  apiKey: string,
): ProviderConnectionStatus {
  if (value === "ready" || value === "needs-key") return value;
  if (value === "needs-runtime") return "needs-key";

  const providerOption = getProviderConnectionProviderOption(provider);
  return providerOption.apiKeyRequired && !apiKey.trim() ? "needs-key" : "ready";
}

function normalizeLegacyLabel(label: string, kind: ProviderConnectionKind) {
  if (label === "Local mock") return "Local";
  if (label === "Remote runtime") return "OpenAI";
  return label || (kind === "remote-runtime" ? "OpenAI" : "Local");
}

function normalizeLegacySummary(summary: string, label: string) {
  if (label === "OpenAI" && summary.includes("configured runtime")) {
    return "OpenAI-compatible chat completion provider.";
  }
  return summary;
}

function normalizeLegacyModel(model: string, label: string) {
  if (label === "Local" && model === "Mock adapter") return "local";
  return model;
}

export function normalizeProviderConnectionRecord(
  value: unknown,
): ProviderConnectionRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const kind = normalizeConnectionKind(value.kind);
  const label = normalizeLegacyLabel(
    readString(value.label, readString(value.name)).trim(),
    kind,
  );
  if (!id || !label) return null;

  const provider = normalizeConnectionProvider(value.provider, kind);
  const providerOption = getProviderConnectionProviderOption(provider);
  const apiKey = readString(value.apiKey).trim();
  const baseUrl = readString(value.baseUrl, readString(value.url)).trim();
  const model = normalizeLegacyModel(
    readString(value.model, readString(value.modelLabel)).trim(),
    label,
  );
  const summary = normalizeLegacySummary(readString(value.summary).trim(), label);
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
    kind,
    provider,
    label,
    apiKey,
    baseUrl: baseUrl || providerOption.defaultBaseUrl,
    model: model || providerOption.defaultModel,
    summary,
    status: normalizeConnectionStatus(value.status, provider, apiKey),
    modelLabel:
      readNullableString(value.modelLabel) ??
      readNullableString(model || providerOption.defaultModel),
    keeperDefault: value.keeperDefault === true,
    maxContext:
      typeof value.maxContext === "number" && Number.isFinite(value.maxContext)
        ? Math.round(value.maxContext)
        : null,
    maxOutput:
      typeof value.maxOutput === "number" && Number.isFinite(value.maxOutput)
        ? Math.round(value.maxOutput)
        : null,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadProviderConnectionRecords() {
  return providerConnections;
}

const providerConnectionRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.providerConnections,
  normalizeRecord: normalizeProviderConnectionRecord,
  seedRecords: providerConnections,
});

export function loadProviderConnectionRecordsFromStorage(rawUrl?: string) {
  return providerConnectionRepository.loadSnapshot(rawUrl);
}

export function saveProviderConnectionRecordsToStorage(
  records: ProviderConnectionRecord[],
  rawUrl?: string,
) {
  return providerConnectionRepository.save(
    records.map(sanitizeProviderConnectionRecord),
    rawUrl,
  );
}
