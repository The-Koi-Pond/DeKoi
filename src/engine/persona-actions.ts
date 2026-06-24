import type { PersonaRecord } from "./persona";

export interface PersonaRecordInput {
  displayName: string;
  summary?: string;
  description?: string;
  avatarUrl?: string | null;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    summary: cleanText(input.summary),
    description: cleanText(input.description),
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
    summary: cleanText(input.summary),
    description: cleanText(input.description),
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
