import type { CharacterRecord } from "../../contracts/types/character";
import type { PersonaRecord } from "../../contracts/types/persona";

export type CharacterMacroFields = Pick<
  CharacterRecord,
  | "displayName"
  | "nickname"
  | "description"
  | "personality"
  | "scenario"
  | "firstMessage"
  | "exampleMessages"
  | "systemPrompt"
  | "postHistoryInstructions"
  | "creator"
  | "characterVersion"
  | "creatorNotes"
  | "characterNote"
>;

type PersonaMacroFields = Pick<PersonaRecord, "displayName">;

/** Values available to Slice 1 macro resolution. */
export interface MacroContext {
  user: string;
  char: string;
  characters: string[];
  characterFields?: CharacterMacroFields | null;
  personaFields?: PersonaMacroFields | null;
  lastInput?: string | null;
  chatId?: string | null;
  model?: string | null;
  lastGenerationType?: string | null;
  idleDuration?: string | null;
}

/** Options that control final resolver output formatting. */
export interface ResolveMacroOptions {
  /** Defaults to trimming the final output unless explicitly set to false. */
  trimResult?: boolean;
}
