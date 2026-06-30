import {
  PROVIDER_CONNECTION_DURABLE_FIELDS,
  PROVIDER_CONNECTION_DURABLE_FIELD_SET,
  getProviderConnectionProviderOption,
  normalizeProviderConnectionProvider,
  sanitizeProviderConnectionRecord,
  type ProviderConnectionKind,
  type ProviderConnectionProvider,
  type ProviderConnectionRecord,
  type ProviderConnectionStatus,
} from "../../../engine/contracts/types/provider-connection";
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

function normalizeConnectionKind(value: unknown): ProviderConnectionKind | null {
  return value === "remote-runtime" ? value : null;
}

function normalizeConnectionProvider(value: unknown) {
  return normalizeProviderConnectionProvider(
    value,
    "openai",
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

function normalizeLegacyLabel(label: string, provider: ProviderConnectionProvider) {
  const providerOption = getProviderConnectionProviderOption(provider);
  const cleanLabel = label.trim();
  if (/^local mock$/i.test(cleanLabel)) return "Local";
  if (/^remote runtime$/i.test(cleanLabel)) return "OpenAI";
  return cleanLabel || providerOption.label;
}

function normalizeLegacySummary(summary: string, label: string) {
  if (label === "OpenAI" && summary.includes("configured runtime")) {
    return "OpenAI-compatible chat completion provider.";
  }
  return summary;
}

function normalizeLegacyModel(model: string) {
  const cleanModel = model.trim();
  return /^mock adapter$/i.test(cleanModel) ? "" : cleanModel;
}

export function normalizeProviderConnectionRecord(
  value: unknown,
  options: { preserveReadyStatus?: boolean } = {},
): ProviderConnectionRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const kind = normalizeConnectionKind(value.kind);
  if (!kind) return null;

  const provider = normalizeConnectionProvider(value.provider);
  const providerOption = getProviderConnectionProviderOption(provider);
  const label = normalizeLegacyLabel(
    readString(value.label, readString(value.name)).trim(),
    provider,
  );
  if (!id || !label) return null;

  const baseUrl = readString(value.baseUrl, readString(value.url)).trim();
  const model = normalizeLegacyModel(
    readString(value.model, readString(value.modelLabel)).trim(),
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

function assertProviderConnectionDurableShape(
  record: ProviderConnectionRecord,
): ProviderConnectionRecord {
  const keys = Object.keys(record).sort();
  const missing = PROVIDER_CONNECTION_DURABLE_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(record, field),
  );
  const extra = keys.filter(
    (field) =>
      !Object.prototype.hasOwnProperty.call(
        PROVIDER_CONNECTION_DURABLE_FIELD_SET,
        field,
      ),
  );

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Provider connection storage record has invalid durable shape. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
    );
  }

  return record;
}

function normalizeDurableProviderConnectionRecord(
  record: ProviderConnectionRecord,
): ProviderConnectionRecord {
  const normalized = normalizeProviderConnectionRecord(record, {
    preserveReadyStatus: true,
  });
  if (!normalized) {
    throw new Error(
      "Provider connection storage record failed durable normalization.",
    );
  }

  return assertProviderConnectionDurableShape(normalized);
}

function assertProviderConnectionDurableRecord(
  record: ProviderConnectionRecord,
  expectedRecord: ProviderConnectionRecord,
): ProviderConnectionRecord {
  const changed = PROVIDER_CONNECTION_DURABLE_FIELDS.filter(
    (field) => !Object.is(record[field], expectedRecord[field]),
  );
  if (changed.length > 0) {
    throw new Error(
      `Provider connection storage record is not durable-normalized. Changed: ${changed.join(", ")}.`,
    );
  }

  return record;
}

function durableProviderConnectionRecord(
  record: ProviderConnectionRecord,
): ProviderConnectionRecord {
  const normalizedRecord = normalizeDurableProviderConnectionRecord(record);
  const normalizedSanitizedRecord = normalizeDurableProviderConnectionRecord(
    sanitizeProviderConnectionRecord(record),
  );

  return assertProviderConnectionDurableRecord(
    normalizedSanitizedRecord,
    normalizedRecord,
  );
}

function withProviderConnectionSecretVerification(
  record: ProviderConnectionRecord,
  secretVerification: NonNullable<
    ProviderConnectionSecretVerification["secretVerification"]
  >,
): ProviderConnectionRecord & ProviderConnectionSecretVerification {
  const verifiedRecord = { ...record };
  Object.defineProperty(verifiedRecord, "secretVerification", {
    value: secretVerification,
    enumerable: false,
    configurable: true,
  });
  return verifiedRecord as ProviderConnectionRecord &
    ProviderConnectionSecretVerification;
}

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
        return withProviderConnectionSecretVerification(record, {
          status: "unverified",
          persistedStatus: record.status,
          message,
        });
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
