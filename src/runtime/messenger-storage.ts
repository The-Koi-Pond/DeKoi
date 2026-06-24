import type { MessengerMessage, MessengerThread } from "../engine/messenger";
import { sampleMessengerThread } from "../engine/sample-messenger";
import {
  invokeRemote,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "./remote-runtime";
import {
  loadMessengerThreads as loadLocalMessengerThreads,
  saveMessengerThreads as saveLocalMessengerThreads,
} from "./messenger-local-storage";

export type MessengerStorageMode = "local" | "remote";
export type MessengerStorageStatus = "loading" | "ready" | "saving" | "error";

export type MessengerStorageSnapshot = {
  threads: MessengerThread[];
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

const MESSENGER_THREADS_ENTITY = "messenger-threads";
const LEGACY_BUBBLE_THREADS_ENTITY = "bubble-threads";

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

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

function hasRemoteRuntime(rawUrl: string) {
  try {
    return remoteRuntimeTarget(rawUrl) !== null;
  } catch {
    return false;
  }
}

async function loadRemoteMessengerThreads(rawUrl: string): Promise<MessengerThread[]> {
  let records: unknown[] = [];
  let newCollectionError: unknown = null;

  try {
    records = await invokeRemote<unknown[]>(
      "storage_list",
      {
        entity: MESSENGER_THREADS_ENTITY,
        options: null,
      },
      rawUrl,
    );
  } catch (error) {
    newCollectionError = error;
  }

  const messengerThreads = normalizeMessengerThreads(records);
  if (messengerThreads.length > 0) return messengerThreads;

  try {
    const legacyRecords = await invokeRemote<unknown[]>(
      "storage_list",
      {
        entity: LEGACY_BUBBLE_THREADS_ENTITY,
        options: null,
      },
      rawUrl,
    );
    return normalizeMessengerThreads(legacyRecords);
  } catch {
    if (newCollectionError) throw newCollectionError;
    return [];
  }

  return [];
}

async function saveRemoteMessengerThreads(threads: MessengerThread[], rawUrl: string) {
  const currentThreads = normalizeMessengerThreads(
    await invokeRemote<unknown[]>(
      "storage_list",
      {
        entity: MESSENGER_THREADS_ENTITY,
        options: null,
      },
      rawUrl,
    ).catch(() => []),
  );
  const currentIds = new Set(currentThreads.map((thread) => thread.id));
  const nextIds = new Set(threads.map((thread) => thread.id));

  await Promise.all(
    threads.map((thread) =>
      currentIds.has(thread.id)
        ? invokeRemote(
            "storage_update",
            {
              entity: MESSENGER_THREADS_ENTITY,
              id: thread.id,
              patch: thread as unknown as Record<string, unknown>,
            },
            rawUrl,
          )
        : invokeRemote(
            "storage_create",
            {
              entity: MESSENGER_THREADS_ENTITY,
              value: thread as unknown as Record<string, unknown>,
            },
            rawUrl,
          ),
    ),
  );

  await Promise.all(
    currentThreads
      .filter((thread) => !nextIds.has(thread.id))
      .map((thread) =>
        invokeRemote(
          "storage_delete",
          {
            entity: MESSENGER_THREADS_ENTITY,
            id: thread.id,
          },
          rawUrl,
        ),
      ),
  );
}

export function loadInitialMessengerThreads(): MessengerThread[] {
  return loadLocalMessengerThreads();
}

export async function loadMessengerThreadsFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<MessengerStorageSnapshot> {
  const localThreads = loadLocalMessengerThreads();
  if (!rawUrl.trim()) {
    return {
      threads: localThreads,
      mode: "local",
      status: "ready",
      message: "Saved locally.",
    };
  }

  if (!hasRemoteRuntime(rawUrl)) {
    return {
      threads: localThreads,
      mode: "local",
      status: "error",
      message: "Remote Runtime URL is invalid; using local storage.",
    };
  }

  try {
    const remoteThreads = await loadRemoteMessengerThreads(rawUrl);
    return {
      threads: remoteThreads.length > 0 ? remoteThreads : localThreads,
      mode: "remote",
      status: "ready",
      message: "Remote runtime storage is active.",
    };
  } catch (error) {
    return {
      threads: localThreads.length > 0 ? localThreads : [sampleMessengerThread],
      mode: "local",
      status: "error",
      message: `Remote runtime unavailable; using local storage. ${asErrorMessage(error)}`,
    };
  }
}

export async function saveMessengerThreadsToStorage(
  threads: MessengerThread[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<MessengerStorageSnapshot, "threads">> {
  saveLocalMessengerThreads(threads);

  if (!rawUrl.trim()) {
    return {
      mode: "local",
      status: "ready",
      message: "Saved locally.",
    };
  }

  if (!hasRemoteRuntime(rawUrl)) {
    return {
      mode: "local",
      status: "error",
      message: "Remote Runtime URL is invalid; saved locally.",
    };
  }

  try {
    await saveRemoteMessengerThreads(threads, rawUrl);
    return {
      mode: "remote",
      status: "ready",
      message: "Saved through remote runtime.",
    };
  } catch (error) {
    return {
      mode: "local",
      status: "error",
      message: `Remote save failed; saved locally. ${asErrorMessage(error)}`,
    };
  }
}
