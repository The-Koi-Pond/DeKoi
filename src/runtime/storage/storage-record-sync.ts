import type { StorageRecord } from "./storage-repository";

export type StorageRecordSyncOperation<T extends StorageRecord> =
  { type: "create"; record: T } | { type: "update"; record: T } | { type: "delete"; record: T };

function comparableRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };
  delete record.createdAt;
  delete record.updatedAt;
  return record;
}

function recordsMatch(left: unknown, right: unknown) {
  return JSON.stringify(comparableRecord(left)) === JSON.stringify(comparableRecord(right));
}

export function planStorageRecordSync<T extends StorageRecord>({
  currentRecords,
  nextRecords,
}: {
  currentRecords: T[];
  nextRecords: T[];
}): StorageRecordSyncOperation<T>[] {
  const currentById = new Map(currentRecords.map((record) => [record.id, record] as const));
  const currentIds = new Set(currentById.keys());
  const nextIds = new Set(nextRecords.map((record) => record.id));

  return [
    ...nextRecords.flatMap((record): StorageRecordSyncOperation<T>[] => {
      const currentRecord = currentById.get(record.id);
      if (currentRecord && recordsMatch(currentRecord, record)) return [];

      return [{ type: currentIds.has(record.id) ? "update" : "create", record }];
    }),
    ...currentRecords
      .filter((record) => !nextIds.has(record.id))
      .map((record): StorageRecordSyncOperation<T> => ({ type: "delete", record })),
  ];
}
