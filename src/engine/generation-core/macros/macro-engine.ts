import { mapMacroSpans } from "./macro-spans";
import { applyBuiltins, renderUnknownMacro } from "./macro-builtins";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

const MAX_MACRO_RESOLUTION_PASSES = 16;

function finalizeResult(result: string, options: ResolveMacroOptions) {
  return options.trimResult === false ? result : result.trim();
}

function resolveMacroPass(input: string, context: MacroContext) {
  return mapMacroSpans(input, ({ body }) => {
    const replacement = applyBuiltins(body, context);
    return replacement ?? renderUnknownMacro(body);
  });
}

/**
 * Resolves Slice 1 DeKoi prompt macros without storage, runtime, or provider access.
 */
export function resolveMacros(
  template: string,
  context: MacroContext,
  options: ResolveMacroOptions = {},
) {
  let result = template;

  for (let pass = 0; pass < MAX_MACRO_RESOLUTION_PASSES; pass += 1) {
    const next = resolveMacroPass(result, context);
    if (next === result) return finalizeResult(next, options);
    result = next;
  }

  const stableAfterFinalPass = resolveMacroPass(result, context);
  if (stableAfterFinalPass === result) return finalizeResult(result, options);

  return finalizeResult(template, options);
}

export type { MacroContext, ResolveMacroOptions } from "./macro-types";
