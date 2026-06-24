import type { BubbleThread } from "../engine/bubbles";
import { sampleBubbleThread } from "../engine/sample-bubbles";
import {
  invokeRemote,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "./remote-runtime";
import {
  loadBubbleThreads as loadLocalBubbleThreads,
  saveBubbleThreads as saveLocalBubbleThreads,
} from "./bubble-local-storage";

export type BubbleStorageMode = "local" | "remote";
export type BubbleStorageStatus = "loading" | "ready" | "saving" | "error";

export type BubbleStorageSnapshot = {
  threads: BubbleThread[];
  mode: BubbleStorageMode;
  status: Exclude<BubbleStorageStatus, "loading" | "saving">;
  message: string;
};

const BUBBLE_THREADS_ENTITY = "bubble-threads";

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function isBubbleThread(value: unknown): value is BubbleThread {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<BubbleThread>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.kind === "bubbles" &&
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.messages)
  );
}

function normalizeBubbleThreads(value: unknown): BubbleThread[] {
  return Array.isArray(value) ? value.filter(isBubbleThread) : [];
}

function hasRemoteRuntime(rawUrl: string) {
  try {
    return remoteRuntimeTarget(rawUrl) !== null;
  } catch {
    return false;
  }
}

async function loadRemoteBubbleThreads(rawUrl: string): Promise<BubbleThread[]> {
  const records = await invokeRemote<unknown[]>(
    "storage_list",
    {
      entity: BUBBLE_THREADS_ENTITY,
      options: null,
    },
    rawUrl,
  );

  return normalizeBubbleThreads(records);
}

async function saveRemoteBubbleThreads(threads: BubbleThread[], rawUrl: string) {
  const currentThreads = await loadRemoteBubbleThreads(rawUrl);
  const currentIds = new Set(currentThreads.map((thread) => thread.id));
  const nextIds = new Set(threads.map((thread) => thread.id));

  await Promise.all(
    threads.map((thread) =>
      currentIds.has(thread.id)
        ? invokeRemote(
            "storage_update",
            {
              entity: BUBBLE_THREADS_ENTITY,
              id: thread.id,
              patch: thread as unknown as Record<string, unknown>,
            },
            rawUrl,
          )
        : invokeRemote(
            "storage_create",
            {
              entity: BUBBLE_THREADS_ENTITY,
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
            entity: BUBBLE_THREADS_ENTITY,
            id: thread.id,
          },
          rawUrl,
        ),
      ),
  );
}

export function loadInitialBubbleThreads(): BubbleThread[] {
  return loadLocalBubbleThreads();
}

export async function loadBubbleThreadsFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<BubbleStorageSnapshot> {
  const localThreads = loadLocalBubbleThreads();
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
    const remoteThreads = await loadRemoteBubbleThreads(rawUrl);
    return {
      threads: remoteThreads.length > 0 ? remoteThreads : localThreads,
      mode: "remote",
      status: "ready",
      message: "Remote runtime storage is active.",
    };
  } catch (error) {
    return {
      threads: localThreads.length > 0 ? localThreads : [sampleBubbleThread],
      mode: "local",
      status: "error",
      message: `Remote runtime unavailable; using local storage. ${asErrorMessage(error)}`,
    };
  }
}

export async function saveBubbleThreadsToStorage(
  threads: BubbleThread[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<BubbleStorageSnapshot, "threads">> {
  saveLocalBubbleThreads(threads);

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
    await saveRemoteBubbleThreads(threads, rawUrl);
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
