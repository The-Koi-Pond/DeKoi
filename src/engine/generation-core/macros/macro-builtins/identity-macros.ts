import type { MacroContext } from "../macro-types";
import { IDENTITY_MACRO_DEFINITIONS, findLiteralMacroDefinition } from "../macro-definitions";
import { cleanMacroValue } from "./shared";

export function resolveIdentityMacro(name: string, context: MacroContext) {
  const definition = findLiteralMacroDefinition(IDENTITY_MACRO_DEFINITIONS, name);
  if (definition === null) return null;

  switch (definition.value) {
    case "user":
      return context.user;
    case "char":
      return context.char;
    case "characters":
      return context.characters.join(", ");
    case "persona":
      return cleanMacroValue(context.personaFields?.displayName) || context.user;
  }
}
