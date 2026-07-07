export interface CatalogTextSelectionRange {
  start: number;
  end: number;
}

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
