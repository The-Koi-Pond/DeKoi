import { resolveCharacterMacro } from "./macro-builtins/character-macros";
import { resolveContextMacro } from "./macro-builtins/context-macros";
import { resolveControlMacro } from "./macro-builtins/control-macros";
import { resolveFormatMacro } from "./macro-builtins/format-macros";
import { resolveIdentityMacro } from "./macro-builtins/identity-macros";
import { resolveRandomMacro } from "./macro-builtins/random-macros";
import { resolveTimeMacro } from "./macro-builtins/time-macros";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

export function renderUnknownMacro(body: string) {
  return `{{${body}}}`;
}

export function applyBuiltins(
  body: string,
  context: MacroContext,
  options: ResolveMacroOptions = {},
) {
  const name = body.trim();

  return (
    resolveControlMacro(name) ??
    resolveIdentityMacro(name, context) ??
    resolveCharacterMacro(name, context) ??
    resolveContextMacro(name, context) ??
    resolveTimeMacro(name, context) ??
    resolveRandomMacro(name, options) ??
    resolveFormatMacro(name)
  );
}
