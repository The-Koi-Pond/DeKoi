import {
  resolveMacrosWithScratchContext,
  type MacroContext,
  type ResolveMacroOptions,
} from "../../../engine/generation-core/macros/macro-engine";
import { mapMacroSpans } from "../../../engine/generation-core/macros/macro-spans";

export interface CatalogTextSelectionRange {
  start: number;
  end: number;
}

export interface CatalogMacroPreviewContext {
  macroContext: MacroContext;
  preserveMacroNames?: readonly string[];
}

const CATALOG_MACRO_PREVIEW_OPTIONS: ResolveMacroOptions = {
  randomSelection: "first",
  trimResult: false,
};

function clampSelectionPosition(position: number, valueLength: number) {
  return Math.min(Math.max(position, 0), valueLength);
}

export function insertMacroText(
  value: string,
  insertText: string,
  selection: CatalogTextSelectionRange | null,
) {
  const fallbackPosition = value.length;
  const start = clampSelectionPosition(selection?.start ?? fallbackPosition, value.length);
  const end = clampSelectionPosition(selection?.end ?? fallbackPosition, value.length);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  const nextValue = `${value.slice(0, rangeStart)}${insertText}${value.slice(rangeEnd)}`;
  const nextCaret = rangeStart + insertText.length;

  return { nextCaret, nextValue };
}

function shieldPreservedMacros(value: string, preserveMacroNames: readonly string[]) {
  if (preserveMacroNames.length === 0) {
    return {
      shieldedValue: value,
      restore: (preview: string) => preview,
    };
  }

  const names = new Set(preserveMacroNames);
  const shields: string[] = [];
  const shieldedValue = mapMacroSpans(value, (span) => `{{${span.body}}}`, {
    replaceRawMacro: (span) => {
      if (!names.has(span.body.trim())) return null;

      const shield = `\x00${shields.length}\x00`;
      shields.push(span.raw);
      return shield;
    },
  });

  return {
    shieldedValue,
    restore: (preview: string) =>
      shields.reduce(
        (restored, raw, index) => restored.replaceAll(`\x00${index}\x00`, raw),
        preview,
      ),
  };
}

export function resolveCatalogMacroPreview(
  value: string,
  previewContext: CatalogMacroPreviewContext,
) {
  if (!value.includes("{{")) return null;

  const { shieldedValue, restore } = shieldPreservedMacros(
    value,
    previewContext.preserveMacroNames ?? [],
  );
  const preview = restore(
    resolveMacrosWithScratchContext(
      shieldedValue,
      previewContext.macroContext,
      CATALOG_MACRO_PREVIEW_OPTIONS,
    ),
  );
  return preview === value ? null : preview;
}
