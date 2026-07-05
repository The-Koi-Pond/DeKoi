import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  attachMessengerMessagesToThreads,
  normalizeMessengerSystemPromptMode,
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

export type MessengerStorageMode = StorageMode;
export type MessengerStorageStatus = "loading" | "ready" | "saving" | "error";

export type MessengerStorageSnapshot = {
  threads: MessengerThread[];
  hasLegacyEmbeddedMessages: boolean;
  droppedRecordCount: number;
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

type MessengerThreadStorageRecord = MessengerThreadRecord & {
  messages?: MessengerMessage[];
};

type NormalizedMessengerThread = {
  thread: MessengerThread;
  droppedRecordCount: number;
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

function normalizeMessengerThreadWithDroppedCount(
  value: unknown,
): NormalizedMessengerThread | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MessengerThread> & { kind?: unknown };
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

    return {
      thread: {
        ...candidate,
        id,
        kind: "messenger",
        title: migrateLegacyTitle(candidate.title),
        providerConnectionId:
          typeof candidate.providerConnectionId === "string"
            ? candidate.providerConnectionId
            : null,
        systemPromptMode: normalizeMessengerSystemPromptMode(candidate.systemPromptMode),
        systemPrompt:
          typeof candidate.systemPrompt === "string"
            ? candidate.systemPrompt
            : DEFAULT_MESSENGER_SYSTEM_PROMPT,
        messages,
      } as MessengerThread,
      droppedRecordCount,
    };
  }

  return null;
}

function normalizeMessengerThread(value: unknown): MessengerThread | null {
  return normalizeMessengerThreadWithDroppedCount(value)?.thread ?? null;
}

export function normalizeMessengerThreads(value: unknown): MessengerThread[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeMessengerThread)
    .filter((thread): thread is MessengerThread => thread !== null);
}

export function loadInitialMessengerThreads(): MessengerThread[] {
  return [];
}

function normalizeMessengerThreadStorageRecord(
  value: unknown,
): StorageRecordNormalization<MessengerThreadStorageRecord> | null {
  const normalized = normalizeMessengerThreadWithDroppedCount(value);
  if (!normalized) return null;

  const { thread } = normalized;
  const record = toMessengerThreadRecord(thread);
  return {
    record: thread.messages.length > 0 ? { ...record, messages: thread.messages } : record,
    droppedRecordCount: normalized.droppedRecordCount,
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
    mode: snapshot.mode,
    status: snapshot.status,
    message: snapshot.mode === "unavailable" ? HOST_STORAGE_UNAVAILABLE_MESSAGE : snapshot.message,
  };
}

export async function saveMessengerThreadsToStorage(
  threads: MessengerThread[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<
  Omit<MessengerStorageSnapshot, "threads" | "hasLegacyEmbeddedMessages" | "droppedRecordCount">
> {
  const result = await messengerThreadRepository.save(threads.map(toMessengerThreadRecord), rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}
