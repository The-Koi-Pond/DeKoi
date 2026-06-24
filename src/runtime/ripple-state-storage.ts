import type {
  Ripple,
  RippleState,
  RippleStateOwnerKind,
  RippleTone,
} from "../engine/ripples";
import {
  invokeRemote,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "./remote-runtime";
import {
  isRecord,
  loadCatalogRecords,
  normalizeCatalogList,
  readString,
  readTimestamp,
  saveCatalogRecords,
} from "./catalog-storage";

const RIPPLE_STATES_STORAGE_KEY = "dekoi:ripple-states:v1";
const RIPPLE_STATES_ENTITY = "ripple-states";

export type RippleStateStorageMode = "local" | "remote";
export type RippleStateStorageStatus = "ready" | "error";

export type RippleStateStorageSnapshot = {
  states: RippleState[];
  mode: RippleStateStorageMode;
  status: RippleStateStorageStatus;
  message: string;
};

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function normalizeRippleTone(value: unknown): RippleTone {
  if (value === "shift" || value === "meter") return value;
  return "note";
}

function normalizeOwnerKind(value: unknown): RippleStateOwnerKind | null {
  if (value === "messenger-thread" || value === "classic-thread") return value;
  return null;
}

function normalizeRipple(value: unknown): Ripple | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  const body = readString(value.body).trim();
  if (!id || (!title && !body)) return null;

  const now = new Date().toISOString();
  const updatedAt = readTimestamp(value.updatedAt, now);

  return {
    id,
    tone: normalizeRippleTone(value.tone),
    title: title || "Untitled ripple",
    body,
    createdAt: readTimestamp(value.createdAt, updatedAt),
    updatedAt,
  };
}

export function normalizeRippleState(value: unknown): RippleState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const legacyThreadId = readString(value.threadId).trim();
  const ownerId = readString(value.ownerId, legacyThreadId).trim();
  const ownerKind =
    normalizeOwnerKind(value.ownerKind) ??
    (legacyThreadId ? "messenger-thread" : null);
  if (!id || !ownerId || !ownerKind) return null;

  const now = new Date().toISOString();
  const ripples = Array.isArray(value.ripples)
    ? value.ripples
        .map(normalizeRipple)
        .filter((ripple): ripple is Ripple => ripple !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    ripples,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function normalizeRippleStates(value: unknown): RippleState[] {
  return normalizeCatalogList(value, normalizeRippleState) ?? [];
}

export function loadRippleStates() {
  return loadCatalogRecords(
    RIPPLE_STATES_STORAGE_KEY,
    [],
    normalizeRippleState,
  );
}

export function saveRippleStates(records: RippleState[]) {
  saveCatalogRecords(RIPPLE_STATES_STORAGE_KEY, records);
}

function hasRemoteRuntime(rawUrl: string) {
  try {
    return remoteRuntimeTarget(rawUrl) !== null;
  } catch {
    return false;
  }
}

async function loadRemoteRippleStates(rawUrl: string): Promise<RippleState[]> {
  return normalizeRippleStates(
    await invokeRemote<unknown[]>(
      "storage_list",
      {
        entity: RIPPLE_STATES_ENTITY,
        options: null,
      },
      rawUrl,
    ),
  );
}

async function saveRemoteRippleStates(states: RippleState[], rawUrl: string) {
  const currentStates = normalizeRippleStates(
    await invokeRemote<unknown[]>(
      "storage_list",
      {
        entity: RIPPLE_STATES_ENTITY,
        options: null,
      },
      rawUrl,
    ).catch(() => []),
  );
  const currentIds = new Set(currentStates.map((state) => state.id));
  const nextIds = new Set(states.map((state) => state.id));

  await Promise.all(
    states.map((state) =>
      currentIds.has(state.id)
        ? invokeRemote(
            "storage_update",
            {
              entity: RIPPLE_STATES_ENTITY,
              id: state.id,
              patch: state as unknown as Record<string, unknown>,
            },
            rawUrl,
          )
        : invokeRemote(
            "storage_create",
            {
              entity: RIPPLE_STATES_ENTITY,
              value: state as unknown as Record<string, unknown>,
            },
            rawUrl,
          ),
    ),
  );

  await Promise.all(
    currentStates
      .filter((state) => !nextIds.has(state.id))
      .map((state) =>
        invokeRemote(
          "storage_delete",
          {
            entity: RIPPLE_STATES_ENTITY,
            id: state.id,
          },
          rawUrl,
        ),
      ),
  );
}

export async function loadRippleStatesFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<RippleStateStorageSnapshot> {
  const localStates = loadRippleStates();
  if (!rawUrl.trim()) {
    return {
      states: localStates,
      mode: "local",
      status: "ready",
      message: "Ripple Dock saved locally.",
    };
  }

  if (!hasRemoteRuntime(rawUrl)) {
    return {
      states: localStates,
      mode: "local",
      status: "error",
      message: "Remote Runtime URL is invalid; Ripple Dock is using local storage.",
    };
  }

  try {
    const remoteStates = await loadRemoteRippleStates(rawUrl);
    return {
      states: remoteStates.length > 0 ? remoteStates : localStates,
      mode: "remote",
      status: "ready",
      message: "Ripple Dock remote storage is active.",
    };
  } catch (error) {
    return {
      states: localStates,
      mode: "local",
      status: "error",
      message: `Ripple Dock remote storage unavailable; using local storage. ${asErrorMessage(error)}`,
    };
  }
}

export async function saveRippleStatesToStorage(
  states: RippleState[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<RippleStateStorageSnapshot, "states">> {
  saveRippleStates(states);

  if (!rawUrl.trim()) {
    return {
      mode: "local",
      status: "ready",
      message: "Ripple Dock saved locally.",
    };
  }

  if (!hasRemoteRuntime(rawUrl)) {
    return {
      mode: "local",
      status: "error",
      message: "Remote Runtime URL is invalid; Ripple Dock saved locally.",
    };
  }

  try {
    await saveRemoteRippleStates(states, rawUrl);
    return {
      mode: "remote",
      status: "ready",
      message: "Ripple Dock saved through remote runtime.",
    };
  } catch (error) {
    return {
      mode: "local",
      status: "error",
      message: `Ripple Dock remote save failed; saved locally. ${asErrorMessage(error)}`,
    };
  }
}
