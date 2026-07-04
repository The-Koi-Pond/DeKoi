import type { MacroContext } from "../macro-types";
import { cleanMacroValue } from "./shared";

export function resolveIdentityMacro(name: string, context: MacroContext) {
  switch (name) {
    case "user":
    case "userName":
      return context.user;
    case "char":
    case "charName":
      return context.char;
    case "characters":
      return context.characters.join(", ");
    case "persona":
      return cleanMacroValue(context.personaFields?.displayName) || context.user;
    default:
      return null;
  }
}
