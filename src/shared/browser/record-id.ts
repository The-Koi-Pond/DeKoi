export function createRecordId(prefix: string) {
  const randomUUID =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID.bind(crypto) : null;

  if (randomUUID) {
    return `${prefix}-${randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
