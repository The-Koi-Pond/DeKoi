import type { ResolveMacroOptions } from "../macro-types";

const RANDOM_DOUBLE_COLON_PREFIX = "random::";
const RANDOM_COLON_PREFIX = "random:";
const ROLL_PREFIX = "roll:";
const MAX_DICE_COUNT = 1000;
const MAX_DICE_SIDES = 1_000_000;

interface WeightedRandomOption {
  value: string;
  weight: number;
}

function sampleRandom(options: ResolveMacroOptions) {
  const value = options.random?.() ?? Math.random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

function parseRandomOptions(name: string) {
  if (name.startsWith(RANDOM_DOUBLE_COLON_PREFIX)) {
    return name.slice(RANDOM_DOUBLE_COLON_PREFIX.length).split("::");
  }

  if (name.startsWith(RANDOM_COLON_PREFIX)) {
    const options = name.slice(RANDOM_COLON_PREFIX.length);
    const separator = options.indexOf(":");
    if (separator === -1) return null;

    return [options.slice(0, separator), options.slice(separator + 1)];
  }

  return null;
}

function parseWeightedOption(rawOption: string): WeightedRandomOption {
  const value = rawOption.trim();
  const weightMatch = /^(.*?)(?:\s*)@([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(value);
  if (weightMatch === null) return { value, weight: 1 };

  const weight = Number(weightMatch[2]);
  return {
    value: weightMatch[1].trimEnd(),
    weight: Number.isFinite(weight) ? Math.max(0, weight) : 1,
  };
}

function resolveWeightedRandom(rawOptions: string[], options: ResolveMacroOptions) {
  if (rawOptions.length === 0) return null;

  const weightedOptions = rawOptions.map(parseWeightedOption).filter((option) => option.weight > 0);
  if (weightedOptions.length === 0) return "";

  const totalWeight = weightedOptions.reduce((total, option) => total + option.weight, 0);
  if (totalWeight <= 0) return "";

  const target = sampleRandom(options) * totalWeight;
  let cursor = 0;

  for (const option of weightedOptions) {
    cursor += option.weight;
    if (target < cursor) return option.value;
  }

  return weightedOptions[weightedOptions.length - 1]?.value ?? "";
}

function parseRollSpec(name: string) {
  if (!name.startsWith(ROLL_PREFIX)) return null;

  const match = /^roll:(\d+)d(\d+)$/i.exec(name);
  if (match === null) return null;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (
    !Number.isSafeInteger(count) ||
    !Number.isSafeInteger(sides) ||
    count <= 0 ||
    sides <= 0 ||
    count > MAX_DICE_COUNT ||
    sides > MAX_DICE_SIDES
  ) {
    return null;
  }

  return { count, sides };
}

function resolveRollMacro(name: string, options: ResolveMacroOptions) {
  const spec = parseRollSpec(name);
  if (spec === null) return null;

  let total = 0;
  for (let die = 0; die < spec.count; die += 1) {
    total += Math.floor(sampleRandom(options) * spec.sides) + 1;
  }

  return String(total);
}

export function resolveRandomMacro(name: string, options: ResolveMacroOptions) {
  if (name === "random") return String(sampleRandom(options));

  const randomOptions = parseRandomOptions(name);
  if (randomOptions !== null) return resolveWeightedRandom(randomOptions, options);

  return resolveRollMacro(name, options);
}
