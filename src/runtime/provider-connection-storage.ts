import {
  providerConnections,
  type ProviderConnectionKind,
  type ProviderConnectionRecord,
  type ProviderConnectionStatus,
} from "../engine/provider-connection";
import {
  isRecord,
  readNullableString,
  readString,
  readTimestamp,
} from "./storage/storage-json";
import { createHostStorageRepository } from "./storage/host-storage";
import { STORAGE_ENTITIES } from "./storage/storage-entities";

function normalizeConnectionKind(value: unknown): ProviderConnectionKind {
  return value === "remote-runtime" ? "remote-runtime" : "mock";
}

function normalizeConnectionStatus(
  value: unknown,
  kind: ProviderConnectionKind,
): ProviderConnectionStatus {
  if (value === "ready" || value === "needs-runtime") return value;
  return kind === "remote-runtime" ? "needs-runtime" : "ready";
}

export function normalizeProviderConnectionRecord(
  value: unknown,
): ProviderConnectionRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const label = readString(value.label).trim();
  if (!id || !label) return null;

  const kind = normalizeConnectionKind(value.kind);
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
    kind,
    label,
    summary: readString(value.summary).trim(),
    status: normalizeConnectionStatus(value.status, kind),
    modelLabel: readNullableString(value.modelLabel),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadProviderConnectionRecords() {
  return providerConnections;
}

const providerConnectionRepository = createHostStorageRepository({
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
  return providerConnectionRepository.save(records, rawUrl);
}
