import type {
  ProviderConnectionKind,
  ProviderConnectionRecord,
  ProviderConnectionStatus,
} from "./provider-connection";

export interface ProviderConnectionInput {
  kind: ProviderConnectionKind;
  label: string;
  summary?: string;
  modelLabel?: string | null;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function statusForKind(kind: ProviderConnectionKind): ProviderConnectionStatus {
  return kind === "remote-runtime" ? "needs-runtime" : "ready";
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
  return {
    id,
    schemaVersion: 1,
    kind: input.kind,
    label: cleanText(input.label, "Unnamed connection"),
    summary: cleanText(input.summary),
    status: statusForKind(input.kind),
    modelLabel: cleanNullableText(input.modelLabel),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProviderConnectionRecord(
  record: ProviderConnectionRecord,
  input: ProviderConnectionInput,
  updatedAt: string,
): ProviderConnectionRecord {
  return {
    ...record,
    kind: input.kind,
    label: cleanText(input.label, record.label),
    summary: cleanText(input.summary),
    status: statusForKind(input.kind),
    modelLabel: cleanNullableText(input.modelLabel),
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
