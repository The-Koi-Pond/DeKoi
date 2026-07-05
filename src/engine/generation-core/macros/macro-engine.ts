import {
  applyFinalFormatPostProcessors,
  resolveMacroPassWithStructuralMacros,
} from "./macro-conditions";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

const MAX_MACRO_RESOLUTION_PASSES = 16;

function finalizeResult(result: string, options: ResolveMacroOptions) {
  return options.trimResult === false ? result : result.trim();
}

function finalizeResolvedResult(result: string, options: ResolveMacroOptions) {
  return finalizeResult(applyFinalFormatPostProcessors(result), options);
}

function resolveMacroPass(input: string, context: MacroContext, options: ResolveMacroOptions) {
  return resolveMacroPassWithStructuralMacros(input, context, options);
}

function snapshotMacroContext(context: MacroContext): MacroContext {
  if (context.now !== null && context.now !== undefined) return context;

  return {
    ...context,
    now: new Date(),
  };
}

/**
 * Resolves DeKoi prompt macros without storage, runtime, or provider access.
 * If context.now is omitted, the current time is snapped once per resolver call.
 * If options.random is omitted, random and dice macros use Math.random.
 */
export function resolveMacros(
  template: string,
  context: MacroContext,
  options: ResolveMacroOptions = {},
) {
  let result = template;
  const resolutionContext = snapshotMacroContext(context);

  for (let pass = 0; pass < MAX_MACRO_RESOLUTION_PASSES; pass += 1) {
    const next = resolveMacroPass(result, resolutionContext, options);
    if (next === result) return finalizeResolvedResult(next, options);
    result = next;
  }

  const stableAfterFinalPass = resolveMacroPass(result, resolutionContext, options);
  if (stableAfterFinalPass === result) return finalizeResolvedResult(result, options);

  return finalizeResult(template, options);
}

export type { MacroContext, ResolveMacroOptions } from "./macro-types";
