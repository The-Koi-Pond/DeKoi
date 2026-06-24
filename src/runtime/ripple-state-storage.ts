import type {
  Ripple,
  RippleState,
  RippleStateOwnerKind,
  RippleTone,
} from "../engine/ripples";
import {
  isRecord,
  loadCatalogRecords,
  readString,
  readTimestamp,
  saveCatalogRecords,
} from "./catalog-storage";

const RIPPLE_STATES_STORAGE_KEY = "dekoi:ripple-states:v1";

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
