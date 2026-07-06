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

/** Time source accepted by the ECMAScript Date constructor for time macros. */
export type MacroTimeSource = Date | string | number;

/** Random source for random and dice macros. */
type MacroRandomSource = () => number;
type MacroRandomSelection = "first" | "longest" | "sample";

export type MacroVariableMutation =
  { kind: "add"; name: string; delta: number } | { kind: "set"; name: string; value: string };

/** Values available to macro resolution. */
export interface MacroContext {
  user: string;
  char: string;
  characters: string[];
  /** Request-local string variables read and mutated by variable macros. */
  variables: Record<string, string>;
  /** Optional mutation log for callers that preview and later replay changes. */
  variableMutations?: MacroVariableMutation[];
  characterFields?: CharacterMacroFields | null;
  personaFields?: PersonaMacroFields | null;
  lastInput?: string | null;
  chatId?: string | null;
  model?: string | null;
  lastGenerationType?: string | null;
  idleDuration?: string | null;
  /**
   * Time source for time macros; omitted values snapshot current time once per
   * resolver call.
   */
  now?: MacroTimeSource | null;
  /** IANA time zone for display time macros; omitted values default to UTC. */
  timeZone?: string | null;
}

/** Options that control resolver output formatting and injectable sources. */
export interface ResolveMacroOptions {
  /** Defaults to trimming the final output unless explicitly set to false. */
  trimResult?: boolean;
  /** Defaults to Math.random when omitted. Values are clamped into [0, 1). */
  random?: MacroRandomSource;
  /** Internal deterministic random handling for non-consuming preview passes. */
  randomSelection?: MacroRandomSelection;
}
