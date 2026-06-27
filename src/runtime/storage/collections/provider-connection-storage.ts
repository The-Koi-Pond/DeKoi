import {
  getProviderConnectionProviderOption,
  normalizeProviderConnectionProvider,
  sanitizeProviderConnectionRecord,
  type ProviderConnectionKind,
  type ProviderConnectionProvider,
  type ProviderConnectionRecord,
  type ProviderConnectionStatus,
} from "../../../engine/provider-connection";
import { getDesktopProviderSecretStatus } from "../../../shared/api/desktop-provider-secrets";
import {
  isRecord,
  readNullableString,
  readString,
  readTimestamp,
} from "../storage-json";
import {
  createStorageRepository,
  getHostStorageMode,
} from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";
import type { StorageRecordsSnapshot } from "../storage-repository";

type ProviderConnectionSecretVerification = {
  secretVerification?: {
    status: "unverified";
    persistedStatus: ProviderConnectionStatus;
    message: string;
  };
};

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
  options: { preserveReadyStatus?: boolean } = {},
): ProviderConnectionStatus {
  if (options.preserveReadyStatus && value === "ready") return value;
  if (value === "needs-key") return value;
  if (value === "needs-runtime") return "needs-key";

  const providerOption = getProviderConnectionProviderOption(provider);
  return providerOption.apiKeyRequired ? "needs-key" : "ready";
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
  options: { preserveReadyStatus?: boolean } = {},
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
    baseUrl: baseUrl || providerOption.defaultBaseUrl,
    model: model || providerOption.defaultModel,
    summary,
    status: normalizeConnectionStatus(value.status, provider, options),
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
  return [];
}

const providerConnectionRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.providerConnections,
  normalizeRecord: normalizeProviderConnectionRecord,
  seedRecords: [],
});

const storedProviderConnectionRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.providerConnections,
  normalizeRecord: (value) =>
    normalizeProviderConnectionRecord(value, { preserveReadyStatus: true }),
  seedRecords: [],
});

async function hydrateDesktopProviderConnectionStatuses(
  snapshot: StorageRecordsSnapshot<ProviderConnectionRecord>,
): Promise<StorageRecordsSnapshot<ProviderConnectionRecord>> {
  const verificationErrors: string[] = [];
  const records = await Promise.all(
    snapshot.records.map(async (record) => {
      if (
        record.status !== "ready" ||
        !getProviderConnectionProviderOption(record.provider).apiKeyRequired
      ) {
        return record;
      }

      try {
        const status = await getDesktopProviderSecretStatus(record.id, {
          provider: record.provider,
          baseUrl: record.baseUrl,
        });
        return status.hasSecret
          ? record
          : ({ ...record, status: "needs-key" } satisfies ProviderConnectionRecord);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        verificationErrors.push(message);
        return {
          ...record,
          status: "needs-key",
          secretVerification: {
            status: "unverified",
            persistedStatus: record.status,
            message,
          },
        } satisfies ProviderConnectionRecord & ProviderConnectionSecretVerification;
      }
    }),
  );
  const verificationMessage =
    verificationErrors.length > 0
      ? ` Provider key status verification failed for ${verificationErrors.length} connection(s): ${[
          ...new Set(verificationErrors),
        ].join("; ")}`
      : "";

  return {
    ...snapshot,
    records,
    status: verificationErrors.length > 0 ? "error" : snapshot.status,
    message: verificationMessage
      ? `${snapshot.message}${verificationMessage}`
      : snapshot.message,
  };
}

function durableProviderConnectionRecord(record: ProviderConnectionRecord) {
  const sanitized = sanitizeProviderConnectionRecord(record);
  const secretVerification = (
    record as ProviderConnectionRecord & ProviderConnectionSecretVerification
  ).secretVerification;
  if (secretVerification?.status !== "unverified") return sanitized;

  return {
    ...sanitized,
    status: secretVerification.persistedStatus,
  } satisfies ProviderConnectionRecord;
}

export function loadProviderConnectionRecordsFromStorage(rawUrl?: string) {
  if (getHostStorageMode(rawUrl) !== "desktop") {
    return providerConnectionRepository.loadSnapshot(rawUrl);
  }

  return storedProviderConnectionRepository
    .loadSnapshot(rawUrl)
    .then(hydrateDesktopProviderConnectionStatuses);
}

export function saveProviderConnectionRecordsToStorage(
  records: ProviderConnectionRecord[],
  rawUrl?: string,
) {
  return storedProviderConnectionRepository.save(
    records.map(durableProviderConnectionRecord),
    rawUrl,
  );
}
