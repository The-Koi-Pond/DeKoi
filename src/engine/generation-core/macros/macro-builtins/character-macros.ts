import type { CharacterMacroFields, MacroContext } from "../macro-types";
import { cleanMacroValue } from "./shared";

const CHARACTER_MACRO_FIELDS = new Set<keyof CharacterMacroFields>([
  "displayName",
  "nickname",
  "description",
  "personality",
  "scenario",
  "firstMessage",
  "exampleMessages",
  "systemPrompt",
  "postHistoryInstructions",
  "creator",
  "characterVersion",
  "creatorNotes",
  "characterNote",
]);

export function resolveCharacterMacro(name: string, context: MacroContext) {
  const field = name as keyof CharacterMacroFields;
  if (!CHARACTER_MACRO_FIELDS.has(field)) return null;

  return cleanMacroValue(context.characterFields?.[field]);
}
