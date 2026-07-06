import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { GenerationResponse } from "../../../engine/generation/generation";

interface GeneratedDraftRecordInput {
  body: string;
  companion: CharacterRecord;
  id: string;
  now: string;
}

export interface CreateGeneratedDraftRecordsInput<GeneratedRecord> {
  companions: CharacterRecord[];
  createRecord: (input: GeneratedDraftRecordInput) => GeneratedRecord;
  nextId: () => string;
  response: GenerationResponse;
}

export interface CreateGeneratedDraftRecordsResult<GeneratedRecord> {
  records: GeneratedRecord[];
  warnings: string[];
}

/**
 * Maps generated message drafts into mode-owned records and drops drafts whose
 * companion is no longer available. IDs are allocated only for kept drafts, and
 * warnings are returned in response message order for the caller to merge.
 */
export function createGeneratedDraftRecords<GeneratedRecord>({
  companions,
  createRecord,
  nextId,
  response,
}: CreateGeneratedDraftRecordsInput<GeneratedRecord>): CreateGeneratedDraftRecordsResult<GeneratedRecord> {
  const warnings: string[] = [];
  const records = response.messages.flatMap((messageDraft) => {
    const companion = companions.find((candidate) => candidate.id === messageDraft.characterId);
    if (!companion) {
      warnings.push(
        `Generation response referenced an unavailable companion: ${messageDraft.characterId}.`,
      );
      return [];
    }

    return [
      createRecord({
        body: messageDraft.body,
        companion,
        id: nextId(),
        now: response.createdAt,
      }),
    ];
  });

  return { records, warnings };
}
