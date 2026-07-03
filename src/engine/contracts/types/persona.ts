export const PERSONA_SURFACE_LABEL = "Personas";

export type PersonaNoteRole = "system" | "user" | "assistant";

export interface PersonaRecord {
  id: string;
  schemaVersion: 1;
  displayName: string;
  nickname: string | null;
  description: string;
  personality: string;
  scenario: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creator: string;
  characterVersion: string;
  creatorNotes: string;
  tags: string[];
  characterNote: string;
  characterNoteDepth: number;
  characterNoteRole: PersonaNoteRole;
  talkativeness: number;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
