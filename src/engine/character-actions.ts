import type { CharacterNoteRole, CharacterRecord } from "./character";

export interface CharacterRecordInput {
  displayName: string;
  nickname?: string | null;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  alternateGreetings?: string[];
  groupOnlyGreetings?: string[];
  exampleMessages?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creator?: string;
  characterVersion?: string;
  creatorNotes?: string;
  tags?: string[];
  characterNote?: string;
  characterNoteDepth?: number;
  characterNoteRole?: CharacterNoteRole;
  talkativeness?: number;
  avatarUrl?: string | null;
  lorebookIds?: string[];
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanLorebookIds(value: string[] | undefined) {
  return [...new Set(value ?? [])].filter(Boolean);
}

function cleanTextArray(value: string[] | undefined) {
  return [...new Set(value?.map((item) => item.trim()).filter(Boolean) ?? [])];
}

function cleanNoteRole(value: CharacterNoteRole | undefined) {
  return value === "user" || value === "assistant" ? value : "system";
}

function cleanDepth(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 4;
  return Math.max(0, Math.min(99, Math.round(value)));
}

function cleanTalkativeness(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createCharacterRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: CharacterRecordInput;
  now: string;
}): CharacterRecord {
  return {
    id,
    schemaVersion: 1,
    displayName: cleanText(input.displayName, "Unnamed companion"),
    nickname: cleanNullableText(input.nickname),
    description: cleanText(input.description),
    personality: cleanText(input.personality),
    scenario: cleanText(input.scenario),
    firstMessage: cleanText(input.firstMessage),
    alternateGreetings: cleanTextArray(input.alternateGreetings),
    groupOnlyGreetings: cleanTextArray(input.groupOnlyGreetings),
    exampleMessages: cleanText(input.exampleMessages),
    systemPrompt: cleanText(input.systemPrompt),
    postHistoryInstructions: cleanText(input.postHistoryInstructions),
    creator: cleanText(input.creator),
    characterVersion: cleanText(input.characterVersion),
    creatorNotes: cleanText(input.creatorNotes),
    tags: cleanTextArray(input.tags),
    characterNote: cleanText(input.characterNote),
    characterNoteDepth: cleanDepth(input.characterNoteDepth),
    characterNoteRole: cleanNoteRole(input.characterNoteRole),
    talkativeness: cleanTalkativeness(input.talkativeness),
    avatarUrl: cleanNullableText(input.avatarUrl),
    lorebookIds: cleanLorebookIds(input.lorebookIds),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCharacterRecord(
  record: CharacterRecord,
  input: CharacterRecordInput,
  updatedAt: string,
): CharacterRecord {
  return {
    ...record,
    displayName: cleanText(input.displayName, record.displayName),
    nickname: cleanNullableText(input.nickname),
    description: cleanText(input.description),
    personality: cleanText(input.personality),
    scenario: cleanText(input.scenario),
    firstMessage: cleanText(input.firstMessage),
    alternateGreetings: cleanTextArray(input.alternateGreetings),
    groupOnlyGreetings: cleanTextArray(input.groupOnlyGreetings),
    exampleMessages: cleanText(input.exampleMessages),
    systemPrompt: cleanText(input.systemPrompt),
    postHistoryInstructions: cleanText(input.postHistoryInstructions),
    creator: cleanText(input.creator),
    characterVersion: cleanText(input.characterVersion),
    creatorNotes: cleanText(input.creatorNotes),
    tags: cleanTextArray(input.tags),
    characterNote: cleanText(input.characterNote),
    characterNoteDepth: cleanDepth(input.characterNoteDepth),
    characterNoteRole: cleanNoteRole(input.characterNoteRole),
    talkativeness: cleanTalkativeness(input.talkativeness),
    avatarUrl: cleanNullableText(input.avatarUrl),
    lorebookIds: cleanLorebookIds(input.lorebookIds),
    updatedAt,
  };
}

export function duplicateCharacterRecord(
  record: CharacterRecord,
  id: string,
  now: string,
): CharacterRecord {
  return {
    ...record,
    id,
    displayName: `${record.displayName} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteCharacterRecord(records: CharacterRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function removeCharacterLorebook(
  record: CharacterRecord,
  lorebookId: string,
  updatedAt: string,
): CharacterRecord {
  if (!record.lorebookIds.includes(lorebookId)) return record;

  return {
    ...record,
    lorebookIds: record.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  };
}
