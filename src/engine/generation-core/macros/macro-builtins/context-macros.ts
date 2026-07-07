import type { MacroContext } from "../macro-types";
import {
  CONTEXT_MACRO_DEFINITIONS,
  findLiteralMacroDefinition,
  readContextMacroField,
} from "../macro-definitions";
import { cleanMacroValue } from "./shared";

export function resolveContextMacro(name: string, context: MacroContext) {
  const definition = findLiteralMacroDefinition(CONTEXT_MACRO_DEFINITIONS, name);
  if (definition === null) return null;

  return cleanMacroValue(readContextMacroField(context, definition.field));
}
