import type { AppStorageReplaceResult } from "../features/runtime";

export function appStorageReplaceResultNeedsReload(
  result: AppStorageReplaceResult,
): boolean {
  return (
    result.requiresReload ||
    result.collections.some((collection) => collection.status === "ready")
  );
}
