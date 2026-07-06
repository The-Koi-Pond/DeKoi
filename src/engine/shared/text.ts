// Keep string cleanup behavior in sync with src/shared/text.ts across the engine boundary.
export function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

export function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function cleanTextArray(value: readonly string[] | null | undefined) {
  return [...new Set(value?.map((item) => item.trim()).filter(Boolean) ?? [])];
}
