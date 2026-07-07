import type { CharacterMacroFields, MacroContext } from "../macro-types";
import {
  CHARACTER_FIELD_MACRO_DEFINITIONS,
  findLiteralMacroDefinition,
} from "../macro-definitions";
import { cleanMacroValue } from "./shared";

export function resolveCharacterMacro(name: string, context: MacroContext) {
  const definition = findLiteralMacroDefinition(CHARACTER_FIELD_MACRO_DEFINITIONS, name);
  if (definition === null) return null;

  return cleanMacroValue(context.characterFields?.[definition.field as keyof CharacterMacroFields]);
}
