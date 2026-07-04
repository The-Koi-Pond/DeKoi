export interface MacroSpan {
  raw: string;
  body: string;
  start: number;
  end: number;
}

const MAX_MACRO_PARSE_DEPTH = 64;

export function findMacroSpanClose(input: string, openIndex: number) {
  const startIndex = openIndex;
  if (!input.startsWith("{{", startIndex)) return null;

  let depth = 1;
  let cursor = startIndex + 2;

  while (cursor < input.length) {
    const nextOpen = input.indexOf("{{", cursor);
    const nextClose = input.indexOf("}}", cursor);
    if (nextClose === -1) return null;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      if (depth >= MAX_MACRO_PARSE_DEPTH) return null;
      depth += 1;
      cursor = nextOpen + 2;
      continue;
    }

    depth -= 1;
    const end = nextClose + 2;
    if (depth === 0) return end;
    cursor = end;
  }

  return null;
}

export function mapMacroSpans(input: string, replaceMacro: (span: MacroSpan) => string): string {
  let result = "";
  let cursor = 0;

  while (cursor < input.length) {
    const start = input.indexOf("{{", cursor);
    if (start === -1) {
      result += input.slice(cursor);
      break;
    }

    const end = findMacroSpanClose(input, start);
    if (end === null) {
      result += input.slice(cursor);
      break;
    }

    result += input.slice(cursor, start);

    const raw = input.slice(start, end);
    const originalBody = input.slice(start + 2, end - 2);
    const body = mapMacroSpans(originalBody, replaceMacro);
    result += replaceMacro({ raw, body, start, end });
    cursor = end;
  }

  return result;
}
