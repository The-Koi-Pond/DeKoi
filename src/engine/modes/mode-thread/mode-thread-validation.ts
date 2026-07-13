import { normalizePromptPresetThreadChoiceSelectionsWithChange } from "../../prompt-presets/prompt-preset-normalization";
import { cleanTextArray } from "../../shared/text";
import type {
  ModeMessage,
  ModeMessageAuthor,
  ModeMessageOrigin,
  ModeThread,
  RoleplayReplyStrategy,
} from "../../contracts/types/mode-thread";

const fail = (message: string): never => {
  throw new Error(`Invalid mode thread: ${message}`);
};
const text = (value: unknown, name: string): string =>
  typeof value === "string" && value.trim() ? value : fail(`${name} must be nonblank`);
const deterministicIsoTimestamp =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const timestampInstant = (value: unknown, name: string) => {
  const candidate = text(value, name);
  const match = deterministicIsoTimestamp.exec(candidate);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  const hour = match?.[4] === undefined ? 0 : Number(match[4]);
  const minute = match?.[5] === undefined ? 0 : Number(match[5]);
  const second = match?.[6] === undefined ? 0 : Number(match[6]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const epoch = Date.parse(candidate);
  if (
    !match ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !Number.isFinite(epoch)
  )
    fail(`${name} must be a parseable instant`);
  return { candidate, epoch };
};
const timestamp = (value: unknown, name: string): string => timestampInstant(value, name).candidate;
const timestampAtOrAfter = (
  value: unknown,
  minimum: unknown,
  name: string,
  minimumName: string,
): string => {
  const candidate = timestampInstant(value, name);
  const floor = timestampInstant(minimum, minimumName);
  return candidate.epoch >= floor.epoch
    ? candidate.candidate
    : fail(`${name} must not precede ${minimumName}`);
};
const recordTimestamps = (record: Record<string, unknown>, name: string) => {
  const createdAt = timestamp(record.createdAt, `${name} createdAt`);
  timestampAtOrAfter(record.updatedAt, createdAt, `${name} updatedAt`, "createdAt");
};
const canonicalId = (value: unknown, name: string) => {
  const id = text(value, name);
  return id === id.trim() ? id : fail(`${name} must be canonical`);
};
const nullableCanonicalId = (value: unknown, name: string) =>
  value === null ? null : canonicalId(value, name);
const exactKeys = (record: Record<string, unknown>, keys: readonly string[], name: string) => {
  const allowed = new Set(keys);
  if (Object.keys(record).some((key) => !allowed.has(key))) fail(`${name} shape`);
};
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const canonicalTextArray = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  const raw = value as unknown[];
  if (raw.some((item) => typeof item !== "string")) fail(`${name} must contain strings`);
  const strings = raw as string[];
  const cleaned = cleanTextArray(strings);
  if (cleaned.length !== raw.length || cleaned.some((item, index) => item !== raw[index]))
    fail(`${name} must contain unique canonical IDs`);
  return cleaned;
};

const MODE_MESSAGE_ORIGINS = [
  "manual",
  "generated",
  "imported",
  "sample",
] as const satisfies readonly ModeMessageOrigin[];
const ROLEPLAY_REPLY_STRATEGIES = [
  "natural",
  "manual",
  "ordered",
  "round-robin",
] as const satisfies readonly RoleplayReplyStrategy[];

export function validateModeMessageOrigin(value: unknown): asserts value is ModeMessageOrigin {
  if (!MODE_MESSAGE_ORIGINS.includes(value as ModeMessageOrigin)) fail("version origin");
}

export function validateRoleplayReplyStrategy(
  value: unknown,
): asserts value is RoleplayReplyStrategy {
  if (!ROLEPLAY_REPLY_STRATEGIES.includes(value as RoleplayReplyStrategy)) fail("reply strategy");
}

export function validateModeMessageAuthor(author: unknown): asserts author is ModeMessageAuthor {
  const record = plainRecord(author) ? author : fail("invalid author");
  if (!["persona", "character", "system", "unknown"].includes(record.kind as string))
    fail("invalid author");
  if (record.kind === "persona") {
    exactKeys(record, ["kind", "personaId", "label"], "author");
    canonicalId(record.personaId, "persona id");
  } else if (record.kind === "character") {
    exactKeys(record, ["kind", "characterId", "label"], "author");
    canonicalId(record.characterId, "character id");
  } else {
    exactKeys(record, ["kind", "label"], "author");
  }
  text(record.label, "author label");
}

function validatePresetChoiceHistory(value: unknown) {
  const history = plainRecord(value) ? value : fail("preset choices");
  for (const [presetId, selections] of Object.entries(history)) {
    canonicalId(presetId, "preset history id");
    const canonicalSelections = plainRecord(selections)
      ? selections
      : fail("preset history selections");
    if (normalizePromptPresetThreadChoiceSelectionsWithChange(canonicalSelections).changed)
      fail("preset history selections must be canonical");
  }
}

export function validateModeMessage(
  message: unknown,
  threadId: string,
  branchIds: Set<string>,
): asserts message is ModeMessage {
  const record = plainRecord(message) ? message : fail("message shape");
  exactKeys(
    record,
    [
      "id",
      "schemaVersion",
      "threadId",
      "branchId",
      "author",
      "versions",
      "activeVersionId",
      "createdAt",
      "updatedAt",
    ],
    "message",
  );
  canonicalId(record.id, "message id");
  canonicalId(record.activeVersionId, "active version id");
  const messageThreadId = canonicalId(record.threadId, "thread id");
  const messageBranchId = canonicalId(record.branchId, "branch id");
  recordTimestamps(record, "message");
  if (record.schemaVersion !== 1 || messageThreadId !== threadId || !branchIds.has(messageBranchId))
    fail("message ownership");
  validateModeMessageAuthor(record.author);
  if (!Array.isArray(record.versions) || record.versions.length === 0) fail("message versions");
  const ids = new Set<string>();
  for (const version of record.versions as unknown[]) {
    const versionRecord = plainRecord(version) ? version : fail("version shape");
    exactKeys(versionRecord, ["id", "body", "origin", "createdAt", "updatedAt"], "version");
    const versionId = canonicalId(versionRecord.id, "version id");
    recordTimestamps(versionRecord, "version");
    if (ids.has(versionId)) fail("duplicate version id");
    ids.add(versionId);
    validateModeMessageOrigin(versionRecord.origin);
    if (typeof versionRecord.body !== "string") fail("version body");
  }
  if (!ids.has(canonicalId(record.activeVersionId, "active version id"))) fail("active version");
}

export function assertValidModeThread(value: unknown): asserts value is ModeThread {
  const record = plainRecord(value) ? value : fail("thread shape");
  if ((record.kind !== "messenger" && record.kind !== "roleplay") || record.schemaVersion !== 1)
    fail("thread shape");
  const threadId = canonicalId(record.id, "thread id");
  exactKeys(
    record,
    record.kind === "roleplay"
      ? [
          "id",
          "schemaVersion",
          "kind",
          "title",
          "activeBranchId",
          "messages",
          "createdAt",
          "updatedAt",
          "openingCharacterId",
          "branches",
        ]
      : [
          "id",
          "schemaVersion",
          "kind",
          "title",
          "activeBranchId",
          "messages",
          "createdAt",
          "updatedAt",
          "branches",
        ],
    "thread",
  );
  text(record.title, "thread title");
  if (record.kind === "roleplay")
    nullableCanonicalId(record.openingCharacterId, "opening character");
  if (!Array.isArray(record.branches) || record.branches.length === 0) fail("branches");
  const branchIds = new Set<string>();
  for (const branch of record.branches as unknown[]) {
    const branchRecord = plainRecord(branch) ? branch : fail("branch shape");
    exactKeys(
      branchRecord,
      record.kind === "roleplay"
        ? [
            "id",
            "schemaVersion",
            "kind",
            "threadId",
            "participantMode",
            "characterIds",
            "activePersonaId",
            "lorebookIds",
            "presetId",
            "presetChoiceSelectionsByPresetId",
            "providerConnectionId",
            "createdAt",
            "updatedAt",
            "replyStrategy",
          ]
        : [
            "id",
            "schemaVersion",
            "kind",
            "threadId",
            "participantMode",
            "characterIds",
            "activePersonaId",
            "lorebookIds",
            "presetId",
            "presetChoiceSelectionsByPresetId",
            "providerConnectionId",
            "createdAt",
            "updatedAt",
          ],
      "branch",
    );
    const branchId = canonicalId(branchRecord.id, "branch id");
    const branchThreadId = canonicalId(branchRecord.threadId, "thread id");
    if (branchIds.has(branchId)) fail("duplicate branch id");
    branchIds.add(branchId);
    if (
      branchRecord.schemaVersion !== 1 ||
      branchThreadId !== threadId ||
      branchRecord.kind !== record.kind
    )
      fail("branch ownership or kind");
    recordTimestamps(branchRecord, "branch");
    nullableCanonicalId(branchRecord.activePersonaId, "active persona");
    nullableCanonicalId(branchRecord.presetId, "preset id");
    nullableCanonicalId(branchRecord.providerConnectionId, "provider connection");
    const characters = canonicalTextArray(branchRecord.characterIds, "character ids");
    if (branchRecord.participantMode !== (characters.length > 1 ? "group" : "direct"))
      fail("participant mode");
    canonicalTextArray(branchRecord.lorebookIds, "lorebook ids");
    validatePresetChoiceHistory(branchRecord.presetChoiceSelectionsByPresetId);
    if (record.kind === "roleplay") validateRoleplayReplyStrategy(branchRecord.replyStrategy);
  }
  if (!branchIds.has(canonicalId(record.activeBranchId, "active branch id"))) fail("active branch");
  recordTimestamps(record, "thread");
  if (!Array.isArray(record.messages)) fail("messages");
  const messageIds = new Set<string>();
  for (const message of record.messages as unknown[]) {
    const messageRecord = plainRecord(message) ? message : fail("message shape");
    const messageId = text(messageRecord.id, "message id");
    if (messageIds.has(messageId)) fail("duplicate message id");
    messageIds.add(messageId);
    validateModeMessage(messageRecord, threadId, branchIds);
  }
}

export { canonicalId, timestamp, timestampAtOrAfter };
