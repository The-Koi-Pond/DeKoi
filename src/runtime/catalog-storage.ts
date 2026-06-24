export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function readTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

export function normalizeCatalogList<T extends { id: string }>(
  value: unknown,
  normalizeRecord: (value: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const records: T[] = [];

  for (const item of value) {
    const record = normalizeRecord(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    records.push(record);
  }

  if (value.length > 0 && records.length === 0) return null;
  return records;
}
