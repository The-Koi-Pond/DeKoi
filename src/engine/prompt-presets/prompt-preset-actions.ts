import type { PromptPresetRecord, PromptPresetSampling } from "../contracts/types/prompt-presets";
import { cleanNullableText, cleanText } from "../shared/text";

export interface PromptPresetInput {
  title: string;
  summary?: string | null;
  systemPrompt: string;
  messengerPrompt?: string | null;
  sampling?: PromptPresetSampling | null;
}

function cleanSamplingNumber(value: number | null | undefined, min: number, max: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

function normalizePromptPresetSampling(
  value: PromptPresetSampling | null | undefined,
): PromptPresetSampling | null {
  if (!value) return null;

  const maxTokens = cleanSamplingNumber(value.maxTokens, 1, 131_072);
  const temperature = cleanSamplingNumber(value.temperature, 0, 2);
  const topP = cleanSamplingNumber(value.topP, 0, 1);

  const sampling: PromptPresetSampling = {};
  if (maxTokens !== null) sampling.maxTokens = Math.round(maxTokens);
  if (temperature !== null) sampling.temperature = temperature;
  if (topP !== null) sampling.topP = topP;

  return Object.keys(sampling).length > 0 ? sampling : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const trimmed = readString(value).trim();
  return trimmed ? trimmed : null;
}

function readTimestamp(value: unknown, fallback: string) {
  const timestamp = readString(value).trim();
  return timestamp && !Number.isNaN(Date.parse(timestamp)) ? timestamp : fallback;
}

export function normalizePromptPresetRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const systemPrompt = readString(value.systemPrompt).trim();
  if (!id || !systemPrompt) return null;

  const now = new Date().toISOString();
  const title = readString(value.title).trim() || "Untitled preset";
  const sampling = normalizePromptPresetSampling(isRecord(value.sampling) ? value.sampling : null);

  return {
    id,
    schemaVersion: 1,
    title,
    summary: readNullableString(value.summary),
    systemPrompt,
    messengerPrompt: readNullableString(value.messengerPrompt),
    sampling,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function createPromptPresetRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: PromptPresetInput;
  now: string;
}): PromptPresetRecord {
  return {
    id,
    schemaVersion: 1,
    title: cleanText(input.title, "Untitled preset"),
    summary: cleanNullableText(input.summary),
    systemPrompt: cleanText(input.systemPrompt, "Write the next response in character."),
    messengerPrompt: cleanNullableText(input.messengerPrompt),
    sampling: normalizePromptPresetSampling(input.sampling),
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePromptPresetRecord(
  record: PromptPresetRecord,
  input: PromptPresetInput,
  updatedAt: string,
): PromptPresetRecord {
  return {
    ...record,
    title: cleanText(input.title, record.title),
    summary: cleanNullableText(input.summary),
    systemPrompt: cleanText(input.systemPrompt, record.systemPrompt),
    messengerPrompt:
      input.messengerPrompt === undefined
        ? record.messengerPrompt
        : cleanNullableText(input.messengerPrompt),
    sampling: normalizePromptPresetSampling(input.sampling),
    updatedAt,
  };
}

export function duplicatePromptPresetRecord(
  record: PromptPresetRecord,
  id: string,
  now: string,
): PromptPresetRecord {
  return {
    ...record,
    id,
    title: `${record.title} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function deletePromptPresetRecord(records: PromptPresetRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}
