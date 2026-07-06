// Keep string cleanup behavior in sync with src/engine/shared/text.ts across the engine boundary.
export function cleanTextArray(value: readonly string[] | null | undefined) {
  return [...new Set(value?.map((item) => item.trim()).filter(Boolean) ?? [])];
}
