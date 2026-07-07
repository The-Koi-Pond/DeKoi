import type {
  MacroVariableScope,
  MacroVariableScopeOwnerKind,
} from "../contracts/types/macro-variables";
import type { MacroVariableMutation } from "../generation-core/macros/macro-engine";

export type MacroVariableThreadOwnerKind = Exclude<MacroVariableScopeOwnerKind, "global">;

const GLOBAL_MACRO_VARIABLE_OWNER_ID = "global";

export type MacroVariableStateCreateId = (prefix: string) => string;

export type MacroVariableStateSelection = {
  globalScope: MacroVariableScope | null;
  ownerScope: MacroVariableScope | null;
  variables: Record<string, string>;
};

export type MacroVariableStateCommit = {
  variableMutations: MacroVariableMutation[];
  now: string;
  ownerKind: MacroVariableThreadOwnerKind;
  ownerId: string;
  selection: MacroVariableStateSelection;
};

function selectMacroVariableState({
  macroVariableStates,
  ownerKind,
  ownerId,
}: {
  macroVariableStates: MacroVariableScope[];
  ownerKind: MacroVariableScopeOwnerKind;
  ownerId: string;
}) {
  return (
    macroVariableStates.find(
      (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
    ) ?? null
  );
}

export function deleteMacroVariableStateForOwner(
  macroVariableStates: MacroVariableScope[],
  ownerKind: MacroVariableThreadOwnerKind,
  ownerId: string,
) {
  return macroVariableStates.filter(
    (state) => state.ownerKind !== ownerKind || state.ownerId !== ownerId,
  );
}

export function buildGenerationMacroVariableState({
  macroVariableStates,
  ownerKind,
  ownerId,
}: {
  macroVariableStates: MacroVariableScope[];
  ownerKind: MacroVariableThreadOwnerKind;
  ownerId: string;
}): MacroVariableStateSelection {
  const globalScope = selectMacroVariableState({
    macroVariableStates,
    ownerKind: "global",
    ownerId: GLOBAL_MACRO_VARIABLE_OWNER_ID,
  });
  const ownerScope = selectMacroVariableState({ macroVariableStates, ownerKind, ownerId });

  return {
    globalScope,
    ownerScope,
    variables: {
      ...(globalScope?.variables ?? {}),
      ...(ownerScope?.variables ?? {}),
    },
  };
}

function createMacroVariableScope({
  createId,
  now,
  ownerKind,
  ownerId,
  variables,
}: {
  createId: MacroVariableStateCreateId;
  now: string;
  ownerKind: MacroVariableScopeOwnerKind;
  ownerId: string;
  variables: Record<string, string>;
}): MacroVariableScope {
  return {
    id: createId("macro-variable-state"),
    schemaVersion: 1,
    ownerKind,
    ownerId,
    variables,
    createdAt: now,
    updatedAt: now,
  };
}

function upsertMacroVariableScope(
  macroVariableStates: MacroVariableScope[],
  scope: MacroVariableScope,
) {
  const existing = macroVariableStates.find((state) => state.id === scope.id);
  if (!existing) return [scope, ...macroVariableStates];

  return macroVariableStates.map((state) => (state.id === scope.id ? scope : state));
}

function readVariableNumber(value: string | undefined) {
  const numberValue = Number(value ?? "0");
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function applyMacroVariableMutation(
  variables: Record<string, string>,
  mutation: MacroVariableMutation,
) {
  if (mutation.kind === "set") {
    variables[mutation.name] = mutation.value;
  } else {
    variables[mutation.name] = String(
      readVariableNumber(variables[mutation.name]) + mutation.delta,
    );
  }
}

export function commitGenerationMacroVariableStates({
  createId,
  macroVariableStates,
  now,
  ownerExists,
  ownerId,
  ownerKind,
  selection,
  variableMutations,
}: {
  createId: MacroVariableStateCreateId;
  macroVariableStates: MacroVariableScope[];
  now: MacroVariableStateCommit["now"];
  ownerExists: boolean;
  ownerKind: MacroVariableStateCommit["ownerKind"];
  ownerId: MacroVariableStateCommit["ownerId"];
  selection: MacroVariableStateCommit["selection"];
  variableMutations: MacroVariableStateCommit["variableMutations"];
}) {
  const ownerKeys = new Set(Object.keys(selection.ownerScope?.variables ?? {}));
  const globalKeys = new Set(Object.keys(selection.globalScope?.variables ?? {}));
  const currentGlobalScope = selection.globalScope
    ? (macroVariableStates.find((state) => state.id === selection.globalScope?.id) ?? null)
    : selectMacroVariableState({
        macroVariableStates,
        ownerKind: "global",
        ownerId: GLOBAL_MACRO_VARIABLE_OWNER_ID,
      });
  const currentOwnerScope = selection.ownerScope
    ? (macroVariableStates.find((state) => state.id === selection.ownerScope?.id) ?? null)
    : selectMacroVariableState({ macroVariableStates, ownerKind, ownerId });
  const canUpdateOwnerScope = selection.ownerScope ? currentOwnerScope !== null : ownerExists;
  const nextGlobalVariables: Record<string, string> = {
    ...(currentGlobalScope?.variables ?? selection.globalScope?.variables ?? {}),
  };
  const nextOwnerVariables: Record<string, string> = {
    ...(currentOwnerScope?.variables ?? selection.ownerScope?.variables ?? {}),
  };
  let globalTouched = false;
  let ownerTouched = false;

  for (const mutation of variableMutations) {
    const targetsGlobal = !ownerKeys.has(mutation.name) && globalKeys.has(mutation.name);
    if (targetsGlobal) {
      if (!selection.globalScope || currentGlobalScope) {
        applyMacroVariableMutation(nextGlobalVariables, mutation);
        globalTouched = true;
      }
    } else if (canUpdateOwnerScope) {
      applyMacroVariableMutation(nextOwnerVariables, mutation);
      ownerTouched = true;
    }
  }

  let nextStates = macroVariableStates;
  if (globalTouched) {
    nextStates = upsertMacroVariableScope(nextStates, {
      ...(currentGlobalScope ??
        createMacroVariableScope({
          createId,
          now,
          ownerKind: "global",
          ownerId: GLOBAL_MACRO_VARIABLE_OWNER_ID,
          variables: {},
        })),
      variables: nextGlobalVariables,
      updatedAt: now,
    });
  }

  if (ownerTouched) {
    nextStates = upsertMacroVariableScope(nextStates, {
      ...(currentOwnerScope ??
        selection.ownerScope ??
        createMacroVariableScope({
          createId,
          now,
          ownerKind,
          ownerId,
          variables: {},
        })),
      variables: nextOwnerVariables,
      updatedAt: now,
    });
  }

  return nextStates;
}
