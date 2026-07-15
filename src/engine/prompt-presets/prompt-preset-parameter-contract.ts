import {
  isStandardGenerationParameterKey,
  strictGenerationParameterEntryIsValid,
  type GenerationNumericConstraint,
} from "../generation-core/generation-parameter-contract";
import {
  validateGenerationCustomParameter,
  validateGenerationCustomParameters,
} from "../generation-core/generation-custom-parameter-policy";

export type PromptPresetNumericConstraint = GenerationNumericConstraint;

export const PROMPT_PRESET_NUMERIC_CONSTRAINTS = {
  maxContext: { minimum: 1, maximum: 2_000_000, integer: true },
  sectionInjectionDepth: {
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  sectionInjectionOrder: {
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  groupOrder: {
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
    integer: true,
  },
  choiceSortOrder: { minimum: 0, maximum: Number.MAX_SAFE_INTEGER, integer: true },
} as const satisfies Record<string, PromptPresetNumericConstraint>;

type FieldValidator = (value: unknown) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isNullableBoolean(value: unknown) {
  return value === null || typeof value === "boolean";
}

function isNullableNumberWithinConstraint(
  value: unknown,
  constraint: PromptPresetNumericConstraint,
) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= constraint.minimum &&
      value <= constraint.maximum &&
      (!constraint.integer || Number.isInteger(value)))
  );
}

function customParameterEntryIsValid(
  name: string,
  value: unknown,
): value is Record<"send" | "value", unknown> {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, "send") ||
    !Object.prototype.hasOwnProperty.call(value, "value") ||
    typeof value.send !== "boolean"
  ) {
    return false;
  }
  return validateGenerationCustomParameter(name, value.value).valid;
}

function customParametersAreValid(value: unknown) {
  if (!isRecord(value)) return false;
  const effectiveValues: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!customParameterEntryIsValid(name, entry)) return false;
    effectiveValues[name] = entry.value;
  }
  return validateGenerationCustomParameters(effectiveValues);
}

const LOCAL_PARAMETER_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  maxContext: (value) =>
    isNullableNumberWithinConstraint(value, PROMPT_PRESET_NUMERIC_CONSTRAINTS.maxContext),
  assistantPrefill: isNullableString,
  customThinkingTags: isNullableString,
  customParameters: customParametersAreValid,
  squashSystemMessages: isNullableBoolean,
  showThoughts: isNullableBoolean,
  useMaxContext: isNullableBoolean,
  strictRoleFormatting: isNullableBoolean,
  singleUserMessage: isNullableBoolean,
};

export function promptPresetParametersAreValid(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([key, fieldValue]) => {
    if (isStandardGenerationParameterKey(key)) {
      return strictGenerationParameterEntryIsValid(key, fieldValue);
    }
    return (
      Object.prototype.hasOwnProperty.call(LOCAL_PARAMETER_FIELD_VALIDATORS, key) &&
      LOCAL_PARAMETER_FIELD_VALIDATORS[key]?.(fieldValue) === true
    );
  });
}
