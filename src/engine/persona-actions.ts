import type { PersonaNoteRole, PersonaRecord } from "./persona";

export interface PersonaRecordInput {
  displayName: string;
  nickname?: string | null;
  description?: string;
  personality?: string;
  scenario?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  creator?: string;
  characterVersion?: string;
  creatorNotes?: string;
  tags?: string[];
  characterNote?: string;
  characterNoteDepth?: number;
  characterNoteRole?: PersonaNoteRole;
  talkativeness?: number;
  avatarUrl?: string | null;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanTextArray(value: string[] | undefined) {
  return [...new Set(value?.map((item) => item.trim()).filter(Boolean) ?? [])];
}

function cleanNoteRole(value: PersonaNoteRole | undefined) {
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

export function createPersonaRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: PersonaRecordInput;
  now: string;
}): PersonaRecord {
  return {
    id,
    schemaVersion: 1,
    displayName: cleanText(input.displayName, "Unnamed persona"),
    nickname: cleanNullableText(input.nickname),
    description: cleanText(input.description),
    personality: cleanText(input.personality),
    scenario: cleanText(input.scenario),
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
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePersonaRecord(
  record: PersonaRecord,
  input: PersonaRecordInput,
  updatedAt: string,
): PersonaRecord {
  return {
    ...record,
    displayName: cleanText(input.displayName, record.displayName),
    nickname: cleanNullableText(input.nickname),
    description: cleanText(input.description),
    personality: cleanText(input.personality),
    scenario: cleanText(input.scenario),
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
    updatedAt,
  };
}

export function duplicatePersonaRecord(
  record: PersonaRecord,
  id: string,
  now: string,
): PersonaRecord {
  return {
    ...record,
    id,
    displayName: `${record.displayName} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function deletePersonaRecord(records: PersonaRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}
