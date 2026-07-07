import type { ResolveMacroOptions } from "../macro-types";
import { RANDOM_COLON_PREFIX, RANDOM_DOUBLE_COLON_PREFIX, ROLL_PREFIX } from "../macro-definitions";
import { findMacroSpanClose } from "../macro-spans";

const MAX_DICE_COUNT = 1000;
const MAX_DICE_SIDES = 1_000_000;
const MAX_RANDOM_STRUCTURAL_DEPTH = 64;
const MAX_RANDOM_FORMAT_BLOCK_DEPTH = 64;
const BARE_RANDOM_LONGEST_PREVIEW = String(1 - Number.EPSILON);

interface WeightedRandomOption {
  value: string;
  weight: number;
}

type ResolveRandomOption = (value: string, options?: { commit?: boolean }) => string;

interface MacroBoundary {
  body: string;
  end: number;
}

type FormatBlockName = "uppercase" | "lowercase";

function sampleRandom(options: ResolveMacroOptions) {
  const value = options.random?.() ?? Math.random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1 - Number.EPSILON;
  return value;
}

function readMacroBoundary(input: string, start: number): MacroBoundary | null {
  const end = findMacroSpanClose(input, start);
  if (end === null) return null;

  return {
    body: input.slice(start + 2, end - 2),
    end,
  };
}

function isIfOpenBody(body: string) {
  const trimmed = body.trim();
  return trimmed === "#if" || (trimmed.startsWith("#if") && /\s/.test(trimmed[3] ?? ""));
}

function isIfCloseBody(body: string) {
  return body.trim() === "/if";
}

function readFormatBlockOpenBody(body: string): FormatBlockName | null {
  const trimmed = body.trim();
  return trimmed === "uppercase" || trimmed === "lowercase" ? trimmed : null;
}

function readFormatBlockCloseBody(body: string): FormatBlockName | null {
  const trimmed = body.trim();
  if (trimmed === "/uppercase") return "uppercase";
  if (trimmed === "/lowercase") return "lowercase";
  return null;
}

function findStructuralBlockClose(input: string, openIndex: number) {
  const open = readMacroBoundary(input, openIndex);
  if (open === null || !isIfOpenBody(open.body)) return null;

  let cursor = open.end;
  let depth = 1;

  while (cursor < input.length) {
    const nextStart = input.indexOf("{{", cursor);
    if (nextStart === -1) return null;

    const next = readMacroBoundary(input, nextStart);
    if (next === null) return null;

    if (isIfOpenBody(next.body)) {
      depth += 1;
      if (depth > MAX_RANDOM_STRUCTURAL_DEPTH) return null;
    } else if (isIfCloseBody(next.body)) {
      depth -= 1;
      if (depth === 0) return next.end;
    }

    cursor = next.end;
  }

  return null;
}

function findFormatBlockClose(input: string, openIndex: number) {
  const open = readMacroBoundary(input, openIndex);
  const openName = open === null ? null : readFormatBlockOpenBody(open.body);
  if (open === null || openName === null) return null;

  let cursor = open.end;
  const stack: FormatBlockName[] = [openName];

  while (cursor < input.length) {
    const nextStart = input.indexOf("{{", cursor);
    if (nextStart === -1) return null;

    const next = readMacroBoundary(input, nextStart);
    if (next === null) return null;

    const nestedOpen = readFormatBlockOpenBody(next.body);
    const nestedClose = readFormatBlockCloseBody(next.body);

    if (nestedOpen !== null) {
      stack.push(nestedOpen);
      if (stack.length > MAX_RANDOM_FORMAT_BLOCK_DEPTH) return null;
    } else if (nestedClose !== null) {
      if (stack.at(-1) !== nestedClose) return null;

      stack.pop();
      if (stack.length === 0) return next.end;
    }

    cursor = next.end;
  }

  return null;
}

function findSkippableBlockClose(input: string, openIndex: number) {
  return (
    findStructuralBlockClose(input, openIndex) ??
    findFormatBlockClose(input, openIndex) ??
    findMacroSpanClose(input, openIndex)
  );
}

function splitTopLevel(input: string, separator: string) {
  const values: string[] = [];
  let cursor = 0;
  let start = 0;

  while (cursor < input.length) {
    if (input.startsWith("{{", cursor)) {
      const end = findSkippableBlockClose(input, cursor);
      if (end !== null) {
        cursor = end;
        continue;
      }
    }

    if (input.startsWith(separator, cursor)) {
      values.push(input.slice(start, cursor));
      cursor += separator.length;
      start = cursor;
      continue;
    }

    cursor += 1;
  }

  values.push(input.slice(start));
  return values;
}

function splitSingleColonOptions(input: string) {
  const separator = splitTopLevel(input, ":");
  if (separator.length < 2) return null;

  return [separator[0] ?? "", separator.slice(1).join(":")];
}

function parseRandomOptions(name: string) {
  if (name.startsWith(RANDOM_DOUBLE_COLON_PREFIX)) {
    return splitTopLevel(name.slice(RANDOM_DOUBLE_COLON_PREFIX.length), "::");
  }

  if (name.startsWith(RANDOM_COLON_PREFIX)) {
    const options = name.slice(RANDOM_COLON_PREFIX.length);
    return splitSingleColonOptions(options);
  }

  return null;
}

export function isRandomOptionMacroName(name: string) {
  return name.startsWith(RANDOM_DOUBLE_COLON_PREFIX) || name.startsWith(RANDOM_COLON_PREFIX);
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

function resolveWeightedRandom(
  rawOptions: string[],
  options: ResolveMacroOptions,
  resolveOption?: ResolveRandomOption,
) {
  if (rawOptions.length === 0) return null;

  const weightedOptions = rawOptions.map(parseWeightedOption).filter((option) => option.weight > 0);
  if (weightedOptions.length === 0) return "";

  if (options.randomSelection === "first") {
    const selected = weightedOptions[0]?.value ?? "";
    return resolveOption?.(selected) ?? selected;
  }

  if (options.randomSelection === "longest") {
    let selected = weightedOptions[0]?.value ?? "";
    let selectedPreview = resolveOption?.(selected, { commit: false }) ?? selected;

    for (const option of weightedOptions.slice(1)) {
      const optionPreview = resolveOption?.(option.value, { commit: false }) ?? option.value;
      if (optionPreview.length > selectedPreview.length) {
        selected = option.value;
        selectedPreview = optionPreview;
      }
    }

    return resolveOption?.(selected) ?? selected;
  }

  const totalWeight = weightedOptions.reduce((total, option) => total + option.weight, 0);
  if (totalWeight <= 0) return "";

  const target = sampleRandom(options) * totalWeight;
  let cursor = 0;

  for (const option of weightedOptions) {
    cursor += option.weight;
    if (target < cursor) return resolveOption?.(option.value) ?? option.value;
  }

  const selected = weightedOptions[weightedOptions.length - 1]?.value ?? "";
  return resolveOption?.(selected) ?? selected;
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

export function isRollMacroName(name: string) {
  return parseRollSpec(name) !== null;
}

function resolveRollMacro(name: string, options: ResolveMacroOptions) {
  const spec = parseRollSpec(name);
  if (spec === null) return null;

  if (options.randomSelection === "first") return String(spec.count);
  if (options.randomSelection === "longest") return String(spec.count * spec.sides);

  let total = 0;
  for (let die = 0; die < spec.count; die += 1) {
    total += Math.floor(sampleRandom(options) * spec.sides) + 1;
  }

  return String(total);
}

export function resolveRandomMacro(
  name: string,
  options: ResolveMacroOptions,
  resolveOption?: ResolveRandomOption,
) {
  if (name === "random" && options.randomSelection === "longest") {
    return BARE_RANDOM_LONGEST_PREVIEW;
  }
  if (name === "random" && options.randomSelection && options.randomSelection !== "sample") {
    return "0";
  }
  if (name === "random") return String(sampleRandom(options));

  const randomOptions = parseRandomOptions(name);
  if (randomOptions !== null) return resolveWeightedRandom(randomOptions, options, resolveOption);

  return resolveRollMacro(name, options);
}
