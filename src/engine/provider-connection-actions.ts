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
  return provider.apiKeyRequired && !input.apiKey?.trim()
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
    apiKey: cleanText(input.apiKey),
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
    ...record,
    kind: connectionKindForInput(input),
    provider: provider.value,
    label: cleanText(input.label, record.label),
    apiKey: cleanText(input.apiKey),
    baseUrl: cleanText(input.baseUrl),
    model,
    summary: cleanText(input.summary),
    status: statusForInput(input),
    modelLabel: cleanNullableText(input.modelLabel) ?? cleanNullableText(model),
    keeperDefault: input.keeperDefault ?? record.keeperDefault,
    maxContext: cleanNullableNumber(input.maxContext),
    maxOutput: cleanNullableNumber(input.maxOutput),
    updatedAt,
  };
}

export function duplicateProviderConnectionRecord(
  record: ProviderConnectionRecord,
  id: string,
  now: string,
): ProviderConnectionRecord {
  return {
    ...record,
    id,
    label: `${record.label} Copy`,
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
