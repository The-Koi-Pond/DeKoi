import type { MacroContext } from "./macro-types";

interface MacroStateSnapshot {
  variableMutationsLength: number | null;
  variables: Record<string, string>;
}

export function snapshotMacroState(context: MacroContext): MacroStateSnapshot {
  return {
    variableMutationsLength: context.variableMutations?.length ?? null,
    variables: { ...context.variables },
  };
}

export function restoreMacroState(context: MacroContext, snapshot: MacroStateSnapshot) {
  for (const name of Object.keys(context.variables)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot.variables, name)) {
      delete context.variables[name];
    }
  }

  for (const [name, value] of Object.entries(snapshot.variables)) {
    context.variables[name] = value;
  }

  if (snapshot.variableMutationsLength !== null && context.variableMutations) {
    context.variableMutations.length = snapshot.variableMutationsLength;
  }
}
