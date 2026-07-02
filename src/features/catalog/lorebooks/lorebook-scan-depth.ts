export function readScanDepthInput(value: string, fallback: number) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return fallback;
  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.trunc(numericValue));
}
