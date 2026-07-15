export type GenerationJsonValue =
  null | boolean | string | number | GenerationJsonValue[] | { [key: string]: GenerationJsonValue };

const GENERATION_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

const GENERATION_VERBOSITIES = ["low", "medium", "high", "xhigh", "max"] as const;

const GENERATION_SERVICE_TIERS = [
  "auto",
  "default",
  "flex",
  "scale",
  "priority",
  "standard_only",
] as const;

export interface GenerationNumericConstraint {
  minimum: number;
  maximum: number;
  integer: boolean;
}

type NumericParameterSpec = GenerationNumericConstraint & {
  kind: "number";
  fallback?: number;
};

type EnumParameterSpec<Values extends readonly string[]> = {
  kind: "enum";
  options: Values;
};

type StringArrayParameterSpec = { kind: "string-array" };

/** Provider-neutral outbound parameters and all validation metadata they own. */
export const GENERATION_PARAMETER_SPEC = {
  maxTokens: { kind: "number", minimum: 1, maximum: 131_072, integer: true, fallback: 1024 },
  temperature: { kind: "number", minimum: 0, maximum: 2, integer: false, fallback: 0.8 },
  topP: { kind: "number", minimum: 0, maximum: 1, integer: false, fallback: 0.95 },
  topK: { kind: "number", minimum: 0, maximum: 1_000, integer: true },
  minP: { kind: "number", minimum: 0, maximum: 1, integer: false },
  frequencyPenalty: { kind: "number", minimum: -2, maximum: 2, integer: false },
  presencePenalty: { kind: "number", minimum: -2, maximum: 2, integer: false },
  reasoningEffort: { kind: "enum", options: GENERATION_REASONING_EFFORTS },
  verbosity: { kind: "enum", options: GENERATION_VERBOSITIES },
  serviceTier: { kind: "enum", options: GENERATION_SERVICE_TIERS },
  stopSequences: { kind: "string-array" },
} as const satisfies Record<
  string,
  NumericParameterSpec | EnumParameterSpec<readonly string[]> | StringArrayParameterSpec
>;

export type StandardGenerationParameterKey = keyof typeof GENERATION_PARAMETER_SPEC;
export type GenerationNumericParameterKey = {
  [Key in StandardGenerationParameterKey]: (typeof GENERATION_PARAMETER_SPEC)[Key] extends {
    kind: "number";
  }
    ? Key
    : never;
}[StandardGenerationParameterKey];
export type GenerationEnumParameterKey = {
  [Key in StandardGenerationParameterKey]: (typeof GENERATION_PARAMETER_SPEC)[Key] extends {
    kind: "enum";
  }
    ? Key
    : never;
}[StandardGenerationParameterKey];
export type GenerationStringArrayParameterKey = {
  [Key in StandardGenerationParameterKey]: (typeof GENERATION_PARAMETER_SPEC)[Key] extends {
    kind: "string-array";
  }
    ? Key
    : never;
}[StandardGenerationParameterKey];

type GenerationParameterValueForSpec<Spec> = Spec extends { kind: "number" }
  ? number
  : Spec extends { kind: "enum"; options: readonly (infer Value extends string)[] }
    ? Value
    : Spec extends { kind: "string-array" }
      ? string[]
      : never;

export type StandardGenerationParameterValue<Key extends StandardGenerationParameterKey> =
  GenerationParameterValueForSpec<(typeof GENERATION_PARAMETER_SPEC)[Key]>;

type StandardGenerationParameterValues = {
  [Key in StandardGenerationParameterKey]: StandardGenerationParameterValue<Key>;
};

export type GenerationParameterEntry<Value> =
  { send: true; value: Value } | { send: false; value: Value | null };

export type GenerationDraftParameterEntry<Value> = { send: boolean; value: Value | null };

export type GenerationParameterEntries = {
  [Key in StandardGenerationParameterKey]?: GenerationParameterEntry<
    StandardGenerationParameterValue<Key>
  >;
};

export type GenerationDraftParameterEntries = {
  [Key in StandardGenerationParameterKey]?: GenerationDraftParameterEntry<
    StandardGenerationParameterValue<Key>
  >;
};

export type GenerationParameterSettings = GenerationParameterEntries & {
  customParameters?: Record<string, GenerationParameterEntry<GenerationJsonValue>>;
};

export type GenerationParameters = Partial<StandardGenerationParameterValues> & {
  customParameters?: Record<string, GenerationJsonValue>;
};

function objectKeys<Key extends string>(value: Record<Key, unknown>) {
  return Object.keys(value) as Key[];
}

export const STANDARD_GENERATION_PARAMETER_KEYS = objectKeys(GENERATION_PARAMETER_SPEC);

export function isStandardGenerationParameterKey(
  key: string,
): key is StandardGenerationParameterKey {
  return Object.prototype.hasOwnProperty.call(GENERATION_PARAMETER_SPEC, key);
}

export function isGenerationNumericParameterKey(
  key: StandardGenerationParameterKey,
): key is GenerationNumericParameterKey {
  return GENERATION_PARAMETER_SPEC[key].kind === "number";
}

export function isGenerationEnumParameterKey(
  key: StandardGenerationParameterKey,
): key is GenerationEnumParameterKey {
  return GENERATION_PARAMETER_SPEC[key].kind === "enum";
}

export function isGenerationStringArrayParameterKey(
  key: StandardGenerationParameterKey,
): key is GenerationStringArrayParameterKey {
  return GENERATION_PARAMETER_SPEC[key].kind === "string-array";
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnProperty(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedStringArray(value: unknown): string[] | null {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return null;
  const result = source.flatMap((item) => {
    if (typeof item !== "string") return [];
    const normalized = item.trim();
    return normalized ? [normalized] : [];
  });
  return result.length === source.length ? result : null;
}

function normalizeValue<Key extends StandardGenerationParameterKey>(
  key: Key,
  value: unknown,
  sent: boolean,
): StandardGenerationParameterValue<Key> | null {
  const spec = GENERATION_PARAMETER_SPEC[key];
  if (spec.kind === "number") {
    if (
      !isFiniteNumber(value) ||
      (sent &&
        (value < spec.minimum ||
          value > spec.maximum ||
          (spec.integer && !Number.isInteger(value))))
    ) {
      return null;
    }
    return value as StandardGenerationParameterValue<Key>;
  }
  if (spec.kind === "enum") {
    if (typeof value !== "string" || !spec.options.some((option) => option === value)) return null;
    return value as StandardGenerationParameterValue<Key>;
  }
  const strings = normalizedStringArray(value);
  return strings as StandardGenerationParameterValue<Key> | null;
}

export function normalizeGenerationParameterEntry<Key extends StandardGenerationParameterKey>(
  key: Key,
  value: unknown,
): GenerationParameterEntry<StandardGenerationParameterValue<Key>> | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source) || typeof source.send !== "boolean" || !hasOwnProperty(source, "value")) {
    return null;
  }
  if (!source.send && source.value === null) return { send: false, value: null };
  const normalizedValue = normalizeValue(key, source.value, source.send);
  if (normalizedValue === null) return null;
  return source.send
    ? { send: true, value: normalizedValue }
    : { send: false, value: normalizedValue };
}

export function strictGenerationParameterEntryIsValid<Key extends StandardGenerationParameterKey>(
  key: Key,
  value: unknown,
) {
  const source = value;
  if (
    !isRecord(source) ||
    Object.keys(source).length !== 2 ||
    !hasOwnProperty(source, "send") ||
    !hasOwnProperty(source, "value") ||
    typeof source.send !== "boolean"
  ) {
    return false;
  }
  if (!source.send && source.value === null) return true;

  const spec = GENERATION_PARAMETER_SPEC[key];
  if (spec.kind === "number") {
    return (
      isFiniteNumber(source.value) &&
      (!source.send ||
        (source.value >= spec.minimum &&
          source.value <= spec.maximum &&
          (!spec.integer || Number.isInteger(source.value))))
    );
  }
  if (spec.kind === "enum") {
    return (
      typeof source.value === "string" && spec.options.some((option) => option === source.value)
    );
  }
  return (
    Array.isArray(source.value) &&
    source.value.every(
      (item) => typeof item === "string" && item.length > 0 && item === item.trim(),
    )
  );
}

export function normalizeGenerationParameterEntries(
  source: Record<string, unknown>,
): GenerationParameterEntries {
  const result: GenerationParameterEntries = {};
  for (const key of STANDARD_GENERATION_PARAMETER_KEYS) {
    const entry = normalizeGenerationParameterEntry(key, source[key]);
    if (entry !== null) assignGenerationParameterEntry(result, key, entry);
  }
  return result;
}

function assignGenerationParameterEntry<Key extends StandardGenerationParameterKey>(
  result: GenerationParameterEntries,
  key: Key,
  entry: GenerationParameterEntry<StandardGenerationParameterValue<Key>>,
) {
  Object.assign(result, { [key]: entry });
}

export function normalizeGenerationParameterValueEntry<Value>(
  value: unknown,
  validateValue: (candidate: unknown) => candidate is Value,
): GenerationParameterEntry<Value> | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source) || typeof source.send !== "boolean" || !hasOwnProperty(source, "value")) {
    return null;
  }
  if (!source.send && source.value === null) return { send: false, value: null };
  if (!validateValue(source.value)) return null;
  return source.send ? { send: true, value: source.value } : { send: false, value: source.value };
}

function applyPresetEntry<Key extends StandardGenerationParameterKey>(
  result: GenerationParameters,
  key: Key,
  entry: GenerationParameterEntry<StandardGenerationParameterValue<Key>>,
) {
  if (entry.send) Object.assign(result, { [key]: entry.value });
}

export function createGenerationParameters(
  parameters: Partial<GenerationParameters> | undefined,
  providerConnection: { maxOutput?: number | null } | null,
  settings: GenerationParameterSettings | null | undefined,
): GenerationParameters {
  const providerMaxOutput =
    typeof providerConnection?.maxOutput === "number" && providerConnection.maxOutput > 0
      ? providerConnection.maxOutput
      : null;
  const result: GenerationParameters = {};

  for (const key of STANDARD_GENERATION_PARAMETER_KEYS) {
    const entry = settings?.[key];
    if (entry !== undefined) {
      applyPresetEntry(result, key, entry);
      continue;
    }
    const spec = GENERATION_PARAMETER_SPEC[key];
    if (spec.kind !== "number" || !("fallback" in spec)) continue;
    const fallbackValue = parameters?.[key];
    Object.assign(result, {
      [key]:
        parameters && hasOwnProperty(parameters, key) && fallbackValue !== undefined
          ? fallbackValue
          : providerMaxOutput !== null && key === "maxTokens"
            ? providerMaxOutput
            : spec.fallback,
    });
  }

  if (settings?.customParameters) {
    const customParameters: Record<string, GenerationJsonValue> = {};
    for (const [name, entry] of Object.entries(settings.customParameters)) {
      if (entry.send) customParameters[name] = entry.value;
    }
    if (Object.keys(customParameters).length > 0) result.customParameters = customParameters;
  }

  if (result.maxTokens !== undefined && providerMaxOutput !== null) {
    result.maxTokens = Math.min(result.maxTokens, providerMaxOutput);
  }
  return result;
}
