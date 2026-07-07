import type { MacroContext, MacroTimeSource } from "../macro-types";
import { TIME_MACRO_DEFINITIONS, findLiteralMacroDefinition } from "../macro-definitions";
import { cleanMacroValue } from "./shared";

const DEFAULT_TIME_ZONE = "UTC";
const TIME_MACRO_LOCALE = "en-US";

function macroDateFromSource(source: MacroTimeSource | null | undefined) {
  const date = source === null || source === undefined ? new Date() : new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTimeZone(timeZone: string | null | undefined) {
  const candidate = cleanMacroValue(timeZone).trim() || DEFAULT_TIME_ZONE;

  try {
    return new Intl.DateTimeFormat(TIME_MACRO_LOCALE, { timeZone: candidate }).resolvedOptions()
      .timeZone;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
}

function formatTimeMacro(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(TIME_MACRO_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatDateMacro(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(TIME_MACRO_LOCALE, {
    day: "numeric",
    month: "long",
    timeZone,
    year: "numeric",
  }).format(date);
}

function formatWeekdayMacro(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(TIME_MACRO_LOCALE, {
    timeZone,
    weekday: "long",
  }).format(date);
}

export function resolveTimeMacro(name: string, context: MacroContext) {
  const definition = findLiteralMacroDefinition(TIME_MACRO_DEFINITIONS, name);
  if (definition === null) return null;

  if (definition.value === "isotime") {
    const date = macroDateFromSource(context.now);
    return date === null ? null : date.toISOString();
  }

  const timeZone = normalizeTimeZone(context.timeZone);
  if (timeZone === null) return null;

  if (definition.value === "timezone") return timeZone;

  const date = macroDateFromSource(context.now);
  if (date === null) return null;

  switch (definition.value) {
    case "time":
      return formatTimeMacro(date, timeZone);
    case "date":
      return formatDateMacro(date, timeZone);
    case "weekday":
      return formatWeekdayMacro(date, timeZone);
  }
}
