import { resolveCharacterMacro } from "./macro-builtins/character-macros";
import { resolveContextMacro } from "./macro-builtins/context-macros";
import { resolveIdentityMacro } from "./macro-builtins/identity-macros";
import type { MacroContext } from "./macro-types";

function isCommentMacro(name: string) {
  return name.startsWith("//");
}

export function renderUnknownMacro(body: string) {
  return `{{${body}}}`;
}

export function applyBuiltins(body: string, context: MacroContext) {
  const name = body.trim();
  if (isCommentMacro(name)) return "";

  return (
    resolveIdentityMacro(name, context) ??
    resolveCharacterMacro(name, context) ??
    resolveContextMacro(name, context)
  );
}
