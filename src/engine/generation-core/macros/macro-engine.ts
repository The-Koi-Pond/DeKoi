import {
  applyFinalFormatPostProcessors,
  createMacroPassShields,
  resolveMacroPassWithStructuralMacros,
  restoreMacroPassShields,
  type MacroShieldState,
  type MacroTextPassResult,
} from "./macro-conditions";
import { restoreMacroState, snapshotMacroState } from "./macro-state";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

const MAX_MACRO_RESOLUTION_PASSES = 16;

function finalizeResult(result: string, options: ResolveMacroOptions) {
  return options.trimResult === false ? result : result.trim();
}

function resolveMacroPass(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  passShields: MacroShieldState,
): MacroTextPassResult {
  return resolveMacroPassWithStructuralMacros(input, context, options, passShields);
}

function finalizeShieldedResolvedResult(
  result: string,
  options: ResolveMacroOptions,
  passShields: MacroShieldState,
) {
  return finalizeResult(
    restoreMacroPassShields(applyFinalFormatPostProcessors(result), passShields),
    options,
  );
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
 * Variable macros mutate context.variables; callers that need previews should
 * pass a scratch context.
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
  const stateBeforeResolution = snapshotMacroState(context);
  const passShields = createMacroPassShields(template);

  for (let pass = 0; pass < MAX_MACRO_RESOLUTION_PASSES; pass += 1) {
    const next = resolveMacroPass(result, resolutionContext, options, passShields);
    if (next.overflowed) {
      restoreMacroState(context, stateBeforeResolution);
      return finalizeResult(template, options);
    }
    if (next.value === result) {
      return finalizeShieldedResolvedResult(next.value, options, passShields);
    }
    result = next.value;
  }

  const stableAfterFinalPass = resolveMacroPass(result, resolutionContext, options, passShields);
  if (stableAfterFinalPass.overflowed) {
    restoreMacroState(context, stateBeforeResolution);
    return finalizeResult(template, options);
  }
  if (stableAfterFinalPass.value === result) {
    return finalizeShieldedResolvedResult(result, options, passShields);
  }

  restoreMacroState(context, stateBeforeResolution);
  return finalizeResult(template, options);
}

/** Creates a preview-safe macro context copy without caller-owned mutation logs. */
export function createScratchMacroContext(context: MacroContext): MacroContext {
  const scratchContext = {
    ...context,
    variables: { ...context.variables },
  };
  delete scratchContext.variableMutations;
  return scratchContext;
}

/** Resolves macros against a scratch context so variable macros do not mutate the caller. */
export function resolveMacrosWithScratchContext(
  template: string,
  context: MacroContext,
  options: ResolveMacroOptions = {},
) {
  return resolveMacros(template, createScratchMacroContext(context), options);
}

export type { MacroContext, MacroVariableMutation, ResolveMacroOptions } from "./macro-types";
export { SUPPORTED_MACRO_CATEGORIES, SUPPORTED_MACROS } from "./macro-catalog";
export type { SupportedMacro, SupportedMacroCategory } from "./macro-catalog";
