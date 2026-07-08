import type { PromptPresetRecord, PromptPresetSampling } from "../contracts/types/prompt-presets";
import { cleanNullableText, cleanText } from "../shared/text";

export interface PromptPresetInput {
  title: string;
  summary?: string | null;
  systemPrompt: string;
  sampling?: PromptPresetSampling | null;
}

function cleanSamplingNumber(value: number | null | undefined, min: number, max: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

export function normalizePromptPresetSampling(
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
