import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  createPromptPresetPackage,
  normalizePromptPresetPackage,
} from "../../../engine/prompt-presets/prompt-preset-package";

const INVALID_FILENAME_CHARACTERS = '<>:"/\\|?*';
const TRAILING_WINDOWS_FILENAME_CHARACTERS = /[. ]+$/;
const WINDOWS_RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function replaceInvalidFilenameCharacters(value: string) {
  return Array.from(value, (character) =>
    character.charCodeAt(0) < 32 || INVALID_FILENAME_CHARACTERS.includes(character)
      ? "-"
      : character,
  ).join("");
}

function promptPresetFilename(title: string) {
  const safeTitle = replaceInvalidFilenameCharacters(title.trim())
    .replace(TRAILING_WINDOWS_FILENAME_CHARACTERS, "")
    .trim();

  const filenameStem =
    safeTitle && !WINDOWS_RESERVED_DEVICE_NAME.test(safeTitle)
      ? safeTitle
      : safeTitle
        ? `prompt-preset-${safeTitle}`
        : "prompt-preset";

  return `${filenameStem}.json`;
}

export function createPromptPresetFileExport(record: PromptPresetRecord, exportedAt: string) {
  return {
    filename: promptPresetFilename(record.title),
    packageValue: createPromptPresetPackage(record, exportedAt),
  };
}

export type PromptPresetFileParseResult =
  { ok: true; preset: PromptPresetRecord } | { ok: false; error: string };

export function parsePromptPresetFileText(text: string): PromptPresetFileParseResult {
  try {
    const preset = normalizePromptPresetPackage(JSON.parse(text) as unknown);
    return preset
      ? { ok: true, preset }
      : { ok: false, error: "File is not a supported, valid prompt preset package." };
  } catch {
    return { ok: false, error: "Prompt preset file must be valid JSON." };
  }
}
