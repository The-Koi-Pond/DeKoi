import {
  attachMessengerMessagesToThreads,
  type MessengerMessage,
  type MessengerThread,
  type MessengerThreadRecord,
  toMessengerThreadRecord,
} from "../../../engine/contracts/types/messenger";
import {
  HOST_STORAGE_UNAVAILABLE_MESSAGE,
  createStorageRepository,
  type StorageMode,
} from "../storage-repository-factory";
import { readRemoteRuntimeUrl } from "../../../shared/api/runtime-target";
import { STORAGE_ENTITIES } from "../storage-entities";
import type { StorageRecordNormalization } from "../storage-repository";
import { readNullableString } from "../storage-json";
import { normalizePromptPresetThreadChoiceSelectionHistories } from "../prompt-preset-relationship-repair";

export type MessengerStorageMode = StorageMode;
export type MessengerStorageStatus = "loading" | "ready" | "saving" | "error";

export type MessengerStorageSnapshot = {
  threads: MessengerThread[];
  hasLegacyEmbeddedMessages: boolean;
  droppedRecordCount: number;
  /** Thread IDs whose accepted persisted shape changed during normalization. */
  normalizationChangedRecordIds: string[];
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

type MessengerThreadStorageRecord = MessengerThreadRecord & {
  messages?: MessengerMessage[];
};

type LegacyMessengerThreadStorageRecord = Omit<
  Partial<MessengerThread>,
  "presetChoiceSelectionsByPresetId"
> & {
  systemPromptMode?: unknown;
  systemPrompt?: unknown;
  kind?: unknown;
  presetChoiceSelections?: unknown;
  presetChoiceSelectionsByPresetId?: unknown;
};

/** Messenger thread plus normalization metadata used by load and bundle import. */
export type NormalizedMessengerThread = {
  thread: MessengerThread;
  droppedRecordCount: number;
  /** Whether the accepted record changed persisted shape during normalization. */
  normalizationChanged: boolean;
  /** @deprecated Bundle import still reports this narrower subset of changes. */
  presetChoiceSelectionsChanged: boolean;
};

function migrateLegacyId(id: string) {
  return id
    .replace(/^bubble-thread/, "messenger-thread")
    .replace(/^bubble-message/, "messenger-message");
}

function migrateLegacyTitle(title: string) {
  return title.replace(/^New Bubble\b/, "New Messenger");
}

export function normalizeMessengerMessageRecord(
  value: unknown,
  fallbackThreadId = "",
): MessengerMessage | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MessengerMessage>;
  const threadId =
    typeof candidate.threadId === "string" && candidate.threadId.trim()
      ? candidate.threadId.trim()
      : fallbackThreadId;
  if (
    typeof candidate.id !== "string" ||
    !threadId ||
    !candidate.author ||
    typeof candidate.body !== "string" ||
    typeof candidate.origin !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    ...candidate,
    id: migrateLegacyId(candidate.id),
    schemaVersion: 1,
    threadId,
  } as MessengerMessage;
}

/** Normalizes one Messenger thread without discarding repair metadata. */
export function normalizeMessengerThreadWithMetadata(
  value: unknown,
): NormalizedMessengerThread | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as LegacyMessengerThreadStorageRecord;
  if (
    candidate.schemaVersion === 1 &&
    (candidate.kind === "messenger" || candidate.kind === "bubbles") &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (Array.isArray(candidate.messages) || candidate.messages === undefined)
  ) {
    const id = migrateLegacyId(candidate.id);
    const messages: MessengerMessage[] = [];
    let droppedRecordCount = 0;
    if (Array.isArray(candidate.messages)) {
      for (const message of candidate.messages) {
        const normalizedMessage = normalizeMessengerMessageRecord(message, id);
        if (normalizedMessage) {
          messages.push(normalizedMessage);
        } else {
          droppedRecordCount += 1;
        }
      }
    }

    const presetId = readNullableString(candidate.presetId);
    const histories = candidate.presetChoiceSelectionsByPresetId;
    const hasLegacySelections = Object.prototype.hasOwnProperty.call(
      candidate,
      "presetChoiceSelections",
    );
    const hasLegacyPromptMode = Object.prototype.hasOwnProperty.call(candidate, "systemPromptMode");
    const hasLegacyPrompt = Object.prototype.hasOwnProperty.call(candidate, "systemPrompt");
    const legacySelections = candidate.presetChoiceSelections;
    const normalizedHistory = normalizePromptPresetThreadChoiceSelectionHistories({
      presetId,
      histories,
      hasLegacySelections,
      legacySelections,
    });
    const candidateWithoutHistory = { ...candidate };
    delete candidateWithoutHistory.presetChoiceSelections;
    delete candidateWithoutHistory.presetChoiceSelectionsByPresetId;
    delete candidateWithoutHistory.systemPromptMode;
    delete candidateWithoutHistory.systemPrompt;

    return {
      thread: {
        ...candidateWithoutHistory,
        id,
        kind: "messenger",
        title: migrateLegacyTitle(candidate.title),
        providerConnectionId:
          typeof candidate.providerConnectionId === "string"
            ? candidate.providerConnectionId
            : null,
        presetId,
        presetChoiceSelectionsByPresetId: normalizedHistory.histories,
        messages,
      } as MessengerThread,
      droppedRecordCount,
      normalizationChanged: normalizedHistory.changed || hasLegacyPromptMode || hasLegacyPrompt,
      presetChoiceSelectionsChanged: normalizedHistory.changed,
    };
  }

  return null;
}

export function loadInitialMessengerThreads(): MessengerThread[] {
  return [];
}

function normalizeMessengerThreadStorageRecord(
  value: unknown,
): StorageRecordNormalization<MessengerThreadStorageRecord> | null {
  const normalized = normalizeMessengerThreadWithMetadata(value);
  if (!normalized) return null;

  const { thread } = normalized;
  const record = toMessengerThreadRecord(thread);
  return {
    record: thread.messages.length > 0 ? { ...record, messages: thread.messages } : record,
    droppedRecordCount: normalized.droppedRecordCount,
    normalizationChanged: normalized.normalizationChanged,
  };
}

const messengerThreadRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.messengerThreads,
  normalizeRecord: normalizeMessengerThreadStorageRecord,
  seedRecords: [],
});

export async function loadMessengerThreadsFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<MessengerStorageSnapshot> {
  const snapshot = await messengerThreadRepository.loadSnapshot(rawUrl);
  const hasLegacyEmbeddedMessages = snapshot.records.some(
    (thread) => Array.isArray(thread.messages) && thread.messages.length > 0,
  );

  return {
    threads: attachMessengerMessagesToThreads(snapshot.records, []),
    hasLegacyEmbeddedMessages,
    droppedRecordCount: snapshot.droppedRecordCount,
    normalizationChangedRecordIds: snapshot.normalizationChangedRecordIds,
    mode: snapshot.mode,
    status: snapshot.status,
    message: snapshot.mode === "unavailable" ? HOST_STORAGE_UNAVAILABLE_MESSAGE : snapshot.message,
  };
}

export async function saveMessengerThreadsToStorage(
  threads: MessengerThread[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<
  Omit<
    MessengerStorageSnapshot,
    "threads" | "hasLegacyEmbeddedMessages" | "droppedRecordCount" | "normalizationChangedRecordIds"
  >
> {
  const result = await messengerThreadRepository.save(threads.map(toMessengerThreadRecord), rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}
