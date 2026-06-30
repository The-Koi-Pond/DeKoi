import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

export function filterLorebookCatalogRecords(
  lorebooks: readonly LorebookRecord[],
  normalizedQuery: string,
) {
  if (!normalizedQuery) return lorebooks;

  return lorebooks.filter((lorebook) =>
    [
      lorebook.title,
      lorebook.summary,
      ...lorebook.entries.flatMap((entry) => [entry.title, entry.body]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

export function countLorebookCatalogEntries(
  lorebooks: readonly LorebookRecord[],
) {
  return lorebooks.reduce(
    (count, lorebook) => count + lorebook.entries.length,
    0,
  );
}
