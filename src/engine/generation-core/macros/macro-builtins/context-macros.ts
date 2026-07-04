import type { MacroContext } from "../macro-types";
import { cleanMacroValue } from "./shared";

export function resolveContextMacro(name: string, context: MacroContext) {
  switch (name) {
    case "input":
      return cleanMacroValue(context.lastInput);
    case "model":
      return cleanMacroValue(context.model);
    case "chatId":
      return cleanMacroValue(context.chatId);
    case "lastGenerationType":
      return cleanMacroValue(context.lastGenerationType);
    case "idle_duration":
      return cleanMacroValue(context.idleDuration);
    default:
      return null;
  }
}
