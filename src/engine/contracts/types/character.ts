export const COMPANION_SURFACE_LABEL = "Companions";

export type CharacterNoteRole = "system" | "user" | "assistant";

export interface CharacterRecord {
  id: string;
  schemaVersion: 1;
  displayName: string;
  nickname: string | null;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];
  groupOnlyGreetings: string[];
  exampleMessages: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creator: string;
  characterVersion: string;
  creatorNotes: string;
  tags: string[];
  characterNote: string;
  characterNoteDepth: number;
  characterNoteRole: CharacterNoteRole;
  talkativeness: number;
  avatarUrl: string | null;
  lorebookIds: string[];
  createdAt: string;
  updatedAt: string;
}
