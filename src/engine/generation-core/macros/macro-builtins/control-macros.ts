import { CONTROL_MACRO_DEFINITIONS, findLiteralMacroDefinition } from "../macro-definitions";

export function resolveControlMacro(name: string) {
  return findLiteralMacroDefinition(CONTROL_MACRO_DEFINITIONS, name)?.output ?? null;
}
