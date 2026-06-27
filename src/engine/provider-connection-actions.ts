import type {
  ProviderConnectionKind,
  ProviderConnectionProvider,
  ProviderConnectionRecord,
  ProviderConnectionStatus,
} from "./provider-connection";
import { getProviderConnectionProviderOption } from "./provider-connection";

export interface ProviderConnectionInput {
  label: string;
  provider: ProviderConnectionProvider;
  apiKey?: string;
  hasSecret?: boolean;
  baseUrl?: string;
  model?: string;
  summary?: string;
  modelLabel?: string | null;
  keeperDefault?: boolean;
  maxContext?: number | null;
  maxOutput?: number | null;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function connectionKindForInput(
  input: ProviderConnectionInput,
): ProviderConnectionKind {
  return input.provider === "custom" && !input.baseUrl?.trim()
    ? "mock"
    : "remote-runtime";
}

function statusForInput(input: ProviderConnectionInput): ProviderConnectionStatus {
  const provider = getProviderConnectionProviderOption(input.provider);
  return provider.apiKeyRequired && !input.apiKey?.trim() && !input.hasSecret
    ? "needs-key"
    : "ready";
}

export function createProviderConnectionRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: ProviderConnectionInput;
  now: string;
}): ProviderConnectionRecord {
  const provider = getProviderConnectionProviderOption(input.provider);
  const model = cleanText(input.model);
  return {
    id,
    schemaVersion: 1,
    kind: connectionKindForInput(input),
    provider: provider.value,
    label: cleanText(input.label, "Unnamed connection"),
    baseUrl: cleanText(input.baseUrl),
    model,
    summary: cleanText(input.summary),
    status: statusForInput(input),
    modelLabel: cleanNullableText(input.modelLabel) ?? cleanNullableText(model),
    keeperDefault: input.keeperDefault ?? false,
    maxContext: cleanNullableNumber(input.maxContext),
    maxOutput: cleanNullableNumber(input.maxOutput),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProviderConnectionRecord(
  record: ProviderConnectionRecord,
  input: ProviderConnectionInput,
  updatedAt: string,
): ProviderConnectionRecord {
  const provider = getProviderConnectionProviderOption(input.provider);
  const model = cleanText(input.model);
  return {
    id: record.id,
    schemaVersion: 1,
    kind: connectionKindForInput(input),
    provider: provider.value,
    label: cleanText(input.label, record.label),
    baseUrl: cleanText(input.baseUrl),
    model,
    summary: cleanText(input.summary),
    status: statusForInput(input),
    modelLabel: cleanNullableText(input.modelLabel) ?? cleanNullableText(model),
    keeperDefault: input.keeperDefault ?? record.keeperDefault,
    maxContext: cleanNullableNumber(input.maxContext),
    maxOutput: cleanNullableNumber(input.maxOutput),
    createdAt: record.createdAt,
    updatedAt,
  };
}

export function duplicateProviderConnectionRecord(
  record: ProviderConnectionRecord,
  id: string,
  now: string,
): ProviderConnectionRecord {
  const provider = getProviderConnectionProviderOption(record.provider);

  return {
    id,
    schemaVersion: 1,
    kind: record.kind,
    provider: record.provider,
    label: `${record.label} Copy`,
    baseUrl: record.baseUrl,
    model: record.model,
    summary: record.summary,
    status: provider.apiKeyRequired ? "needs-key" : "ready",
    modelLabel: record.modelLabel,
    keeperDefault: record.keeperDefault,
    maxContext: record.maxContext,
    maxOutput: record.maxOutput,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteProviderConnectionRecord(
  records: ProviderConnectionRecord[],
  id: string,
) {
  return records.filter((record) => record.id !== id);
}
