import type {
  MessengerMessage,
  MessengerMessageAuthor,
  MessengerMessageOrigin,
  MessengerThread,
  MessengerThreadMode,
} from "../engine/messenger";
import { isRecord, readNullableString, readString, readStringArray, readTimestamp } from "./storage/storage-json";

const LEGACY_BUBBLE_THREADS_STORAGE_KEY = "dekoi:bubble-threads:v1";
const LEGACY_BUBBLE_THREAD_STORAGE_KEY = "dekoi:bubble-thread:first-pond";
const LEGACY_MESSENGER_THREADS_STORAGE_KEY = "dekoi:messenger-threads:v1";

export interface DeKoiLegacyImportData {
  messengerThreads: MessengerThread[];
  sourceLabel: string;
}

export interface DeKoiLegacyImportCounts {
  messengerThreads: number;
  messengerMessages: number;
}

export interface DeKoiLegacyImportPreview {
  data: DeKoiLegacyImportData;
  counts: DeKoiLegacyImportCounts;
  warnings: string[];
}

export type DeKoiLegacyImportParseResult =
  | { ok: true; preview: DeKoiLegacyImportPreview }
  | { ok: false; error: string };

function migrateLegacyId(id: string) {
  return id
    .replace(/^bubble-thread/, "messenger-thread")
    .replace(/^bubble-message/, "messenger-message");
}

function migrateLegacyTitle(title: string) {
  return title.replace(/^New Bubble\b/, "New Messenger");
}

function normalizeOrigin(value: unknown): MessengerMessageOrigin {
  if (
    value === "manual" ||
    value === "generated" ||
    value === "imported" ||
    value === "placeholder" ||
    value === "sample"
  ) {
    return value;
  }

  return "imported";
}

function normalizeMode(value: unknown, characterIds: string[]): MessengerThreadMode {
  if (value === "direct" || value === "group") return value;
  return characterIds.length > 1 ? "group" : "direct";
}

function normalizeAuthor(value: unknown): MessengerMessageAuthor {
  if (!isRecord(value)) {
    return { kind: "unknown", label: "Imported" };
  }

  const label =
    readString(value.label).trim() ||
    readString(value.name).trim() ||
    "Imported";

  if (value.kind === "persona") {
    return {
      kind: "persona",
      personaId: readString(value.personaId).trim() || "legacy-persona",
      label,
    };
  }

  if (value.kind === "character") {
    return {
      kind: "character",
      characterId: readString(value.characterId).trim() || "legacy-character",
      label,
    };
  }

  if (value.kind === "system") {
    return { kind: "system", label };
  }

  return { kind: "unknown", label };
}

function normalizeLegacyMessage(
  value: unknown,
  threadId: string,
  index: number,
): MessengerMessage | null {
  if (!isRecord(value)) return null;

  const body = readString(value.body).trim();
  if (!body) return null;

  const now = new Date().toISOString();
  const id =
    migrateLegacyId(readString(value.id).trim()) ||
    `${threadId}-imported-message-${index + 1}`;

  return {
    id,
    threadId,
    author: normalizeAuthor(value.author),
    body,
    origin: normalizeOrigin(value.origin),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

function normalizeLegacyThread(value: unknown, index: number): MessengerThread | null {
  if (!isRecord(value)) return null;

  const sourceKind = value.kind;
  if (sourceKind !== "bubbles" && sourceKind !== "messenger") return null;

  const now = new Date().toISOString();
  const id =
    migrateLegacyId(readString(value.id).trim()) ||
    `messenger-thread-imported-${index + 1}`;
  const title =
    migrateLegacyTitle(readString(value.title).trim()) ||
    `Imported Messenger ${index + 1}`;
  const characterIds = readStringArray(value.characterIds);
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map((message, messageIndex) =>
          normalizeLegacyMessage(message, id, messageIndex),
        )
        .filter((message): message is MessengerMessage => message !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    kind: "messenger",
    mode: normalizeMode(value.mode, characterIds),
    title,
    characterIds,
    activePersonaId: readNullableString(value.activePersonaId),
    lorebookIds: readStringArray(value.lorebookIds),
    presetId: readNullableString(value.presetId),
    providerConnectionId: readNullableString(value.providerConnectionId),
    messages,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function collectCandidates(value: unknown) {
  const parsed = parseMaybeJson(value);
  const candidates: unknown[] = [];
  let sourceLabel = "Legacy thread JSON";

  if (Array.isArray(parsed)) {
    candidates.push(...parsed);
    return { candidates, sourceLabel };
  }

  if (!isRecord(parsed)) return { candidates, sourceLabel };

  if (parsed.kind === "bubbles" || parsed.kind === "messenger") {
    candidates.push(parsed);
    return { candidates, sourceLabel };
  }

  if (Array.isArray(parsed.threads)) {
    candidates.push(...parsed.threads);
  }

  const storageRecord = isRecord(parsed.localStorage) ? parsed.localStorage : parsed;
  const legacyThreadList = parseMaybeJson(storageRecord[LEGACY_BUBBLE_THREADS_STORAGE_KEY]);
  const legacySingleThread = parseMaybeJson(storageRecord[LEGACY_BUBBLE_THREAD_STORAGE_KEY]);
  const messengerThreadList = parseMaybeJson(storageRecord[LEGACY_MESSENGER_THREADS_STORAGE_KEY]);

  if (Array.isArray(legacyThreadList)) {
    candidates.push(...legacyThreadList);
    sourceLabel = "Legacy Bubbles export";
  }

  if (isRecord(legacySingleThread)) {
    candidates.push(legacySingleThread);
    sourceLabel = "Legacy Bubbles export";
  }

  if (Array.isArray(messengerThreadList)) {
    candidates.push(...messengerThreadList);
    sourceLabel =
      sourceLabel === "Legacy Bubbles export"
        ? "Legacy Bubbles export"
        : "Legacy Messenger export";
  }

  return { candidates, sourceLabel };
}

export function getLegacyImportCounts(
  data: DeKoiLegacyImportData,
): DeKoiLegacyImportCounts {
  return {
    messengerThreads: data.messengerThreads.length,
    messengerMessages: data.messengerThreads.reduce(
      (count, thread) => count + thread.messages.length,
      0,
    ),
  };
}

export function normalizeLegacyImport(
  value: unknown,
): DeKoiLegacyImportParseResult {
  const { candidates, sourceLabel } = collectCandidates(value);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: "No supported legacy thread records were found.",
    };
  }

  const importedThreads = candidates
    .map(normalizeLegacyThread)
    .filter((thread): thread is MessengerThread => thread !== null);

  if (importedThreads.length === 0) {
    return {
      ok: false,
      error: "Legacy records were found, but none could be converted.",
    };
  }

  const warnings: string[] = [];
  if (importedThreads.length !== candidates.length) {
    warnings.push(
      `Skipped ${candidates.length - importedThreads.length} unsupported legacy record(s).`,
    );
  }

  const data: DeKoiLegacyImportData = {
    messengerThreads: importedThreads,
    sourceLabel,
  };

  return {
    ok: true,
    preview: {
      data,
      counts: getLegacyImportCounts(data),
      warnings,
    },
  };
}
