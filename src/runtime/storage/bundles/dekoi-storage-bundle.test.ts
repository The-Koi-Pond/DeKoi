import { describe, expect, it } from "vitest";

import {
  DEKOI_STORAGE_BUNDLE_KIND,
  DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
  normalizeDeKoiStorageBundle,
} from "./dekoi-storage-bundle";

describe("normalizeDeKoiStorageBundle", () => {
  it("reports lorebook schemaVersion 2 when rejecting pre-v2 records", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: "2026-06-24T07:00:00.000Z",
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [
          {
            id: "pre-v2-lorebook",
            schemaVersion: 1,
            title: "Pre-v2 Lorebook",
            summary: "",
            entries: [],
          },
        ],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.warnings).toContain(
      "Lorebooks did not contain valid schema version 2 records.",
    );
    expect(result.preview.warnings).not.toContain(
      "Lorebooks did not contain valid schema version 1 records.",
    );
  });
});
