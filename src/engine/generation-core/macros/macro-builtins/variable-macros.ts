import type { MacroContext } from "../macro-types";
import { VARIABLE_PREFIX_DEFINITIONS } from "../macro-definitions";

type VariablePrefixId = (typeof VARIABLE_PREFIX_DEFINITIONS)[number]["id"];

function readVariablePrefix(id: VariablePrefixId) {
  const definition = VARIABLE_PREFIX_DEFINITIONS.find((candidate) => candidate.id === id);
  if (definition === undefined) {
    throw new Error(`Missing macro variable prefix definition: ${id}`);
  }
  return definition.prefix;
}

const GETVAR_PREFIX = readVariablePrefix("getvar");
const SETVAR_PREFIX = readVariablePrefix("setvar");
const ADDVAR_PREFIX = readVariablePrefix("addvar");
const INCVAR_PREFIX = readVariablePrefix("incvar");
const DECVAR_PREFIX = readVariablePrefix("decvar");

function hasVariable(context: MacroContext, name: string) {
  return Object.prototype.hasOwnProperty.call(context.variables, name);
}

function cleanVariableName(name: string) {
  return name.trim();
}

export function isValidVariableName(name: string) {
  return cleanVariableName(name).length > 0;
}

function splitNameAndValue(input: string) {
  const separator = input.indexOf("::");
  if (separator === -1) return null;

  const name = cleanVariableName(input.slice(0, separator));
  if (!name) return null;

  return {
    name,
    value: input.slice(separator + 2),
  };
}

function readNumber(value: string | undefined) {
  const numberValue = Number(value ?? "0");
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function applyDelta(context: MacroContext, name: string, delta: number) {
  context.variables[name] = String(readNumber(context.variables[name]) + delta);
  context.variableMutations?.push({ kind: "add", name, delta });
  return "";
}

function resolveGetVariable(name: string, context: MacroContext) {
  const variableName = cleanVariableName(name);
  if (!isValidVariableName(variableName) || !hasVariable(context, variableName)) return "";

  return context.variables[variableName] ?? "";
}

function resolveVariableMutation(name: string, context: MacroContext) {
  if (name.startsWith(SETVAR_PREFIX)) {
    const parsed = splitNameAndValue(name.slice(SETVAR_PREFIX.length));
    if (parsed === null) return null;

    context.variables[parsed.name] = parsed.value;
    context.variableMutations?.push({ kind: "set", name: parsed.name, value: parsed.value });
    return "";
  }

  if (name.startsWith(ADDVAR_PREFIX)) {
    const parsed = splitNameAndValue(name.slice(ADDVAR_PREFIX.length));
    if (parsed === null) return null;

    return applyDelta(context, parsed.name, readNumber(parsed.value));
  }

  if (name.startsWith(INCVAR_PREFIX)) {
    const variableName = cleanVariableName(name.slice(INCVAR_PREFIX.length));
    if (!isValidVariableName(variableName)) return null;

    return applyDelta(context, variableName, 1);
  }

  if (name.startsWith(DECVAR_PREFIX)) {
    const variableName = cleanVariableName(name.slice(DECVAR_PREFIX.length));
    if (!isValidVariableName(variableName)) return null;

    return applyDelta(context, variableName, -1);
  }

  return null;
}

export function resolveVariableMacro(name: string, context: MacroContext) {
  if (name.startsWith(GETVAR_PREFIX)) {
    return resolveGetVariable(name.slice(GETVAR_PREFIX.length), context);
  }

  const mutation = resolveVariableMutation(name, context);
  if (mutation !== null) return mutation;

  if (name && hasVariable(context, name)) return context.variables[name] ?? "";

  return null;
}
