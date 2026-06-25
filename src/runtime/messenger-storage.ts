import type { MessengerMessage, MessengerThread } from "../engine/messenger";
import { sampleMessengerThread } from "../engine/sample-messenger";
import {
  HOST_STORAGE_UNAVAILABLE_MESSAGE,
  createHostStorageRepository,
  type HostStorageMode,
} from "./host-storage";
import { readRemoteRuntimeUrl } from "../shared/api/runtime-target";
import { STORAGE_ENTITIES } from "./storage-entities";

export type MessengerStorageMode = HostStorageMode;
export type MessengerStorageStatus = "loading" | "ready" | "saving" | "error";

export type MessengerStorageSnapshot = {
  threads: MessengerThread[];
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

function migrateLegacyId(id: string) {
  return id
    .replace(/^bubble-thread/, "messenger-thread")
    .replace(/^bubble-message/, "messenger-message");
}

function migrateLegacyTitle(title: string) {
  return title.replace(/^New Bubble\b/, "New Messenger");
}

function normalizeMessengerMessage(value: unknown, threadId: string): MessengerMessage | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MessengerMessage>;
  if (
    typeof candidate.id !== "string" ||
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
    threadId,
  } as MessengerMessage;
}

export function normalizeMessengerThread(value: unknown): MessengerThread | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<MessengerThread> & { kind?: unknown };
  if (
    candidate.schemaVersion === 1 &&
    (candidate.kind === "messenger" || candidate.kind === "bubbles") &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages)
  ) {
    const id = migrateLegacyId(candidate.id);
    const messages = candidate.messages
      .map((message) => normalizeMessengerMessage(message, id))
      .filter((message): message is MessengerMessage => message !== null);

    return {
      ...candidate,
      id,
      kind: "messenger",
      title: migrateLegacyTitle(candidate.title),
      providerConnectionId:
        typeof candidate.providerConnectionId === "string"
          ? candidate.providerConnectionId
          : null,
      messages,
    } as MessengerThread;
  }

  return null;
}

export function normalizeMessengerThreads(value: unknown): MessengerThread[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeMessengerThread)
    .filter((thread): thread is MessengerThread => thread !== null);
}

export function loadInitialMessengerThreads(): MessengerThread[] {
  return [sampleMessengerThread];
}

const messengerThreadRepository = createHostStorageRepository({
  entity: STORAGE_ENTITIES.messengerThreads,
  normalizeRecord: normalizeMessengerThread,
  seedRecords: [sampleMessengerThread],
});

export async function loadMessengerThreadsFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<MessengerStorageSnapshot> {
  const snapshot = await messengerThreadRepository.loadSnapshot(rawUrl);

  return {
    threads: snapshot.records,
    mode: snapshot.mode,
    status: snapshot.status,
    message:
      snapshot.mode === "unavailable" ? HOST_STORAGE_UNAVAILABLE_MESSAGE : snapshot.message,
  };
}

export async function saveMessengerThreadsToStorage(
  threads: MessengerThread[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<MessengerStorageSnapshot, "threads">> {
  const result = await messengerThreadRepository.save(threads, rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}
