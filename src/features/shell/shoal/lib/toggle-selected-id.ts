export function toggleSelectedId(ids: readonly string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((selectedId) => selectedId !== id)
    : [...ids, id];
}
