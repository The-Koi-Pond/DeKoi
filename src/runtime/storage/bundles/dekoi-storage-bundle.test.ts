import { describe, expect, it } from "vitest";

import {
  DEKOI_STORAGE_BUNDLE_KIND,
  DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
  createDeKoiStorageBundle,
  normalizeDeKoiStorageBundle,
} from "./dekoi-storage-bundle";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createPersonaRecord } from "../../../engine/catalog/persona-actions";

const now = "2026-06-24T07:00:00.000Z";

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
        promptPresets: [],
        loreRuntimeStates: [],
        macroVariableStates: [],
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

  it("imports missing lore runtime states as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.loreRuntimeStates).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Lore runtime states was missing or not an array; imported as empty.",
    );
  });

  it("imports missing prompt presets as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        loreRuntimeStates: [],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.promptPresets).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Prompt presets was missing or not an array; imported as empty.",
    );
  });

  it("skips lore runtime states whose owner thread is not imported", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: [],
      id: "messenger-thread-imported",
      now,
      title: "Imported",
    });
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [],
        loreRuntimeStates: [
          {
            id: "lore-runtime-state-imported",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "messenger-thread-imported",
            lastEvaluatedMessageCount: 3,
            entries: [],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "lore-runtime-state-orphaned",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "missing-thread",
            lastEvaluatedMessageCount: 3,
            entries: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [thread],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.loreRuntimeStates.map((state) => state.id)).toEqual([
      "lore-runtime-state-imported",
    ]);
    expect(result.preview.warnings).toContain(
      "Lore runtime states skipped 1 record(s) without an imported owner.",
    );
  });

  it("imports missing macro variable states as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        loreRuntimeStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.macroVariableStates).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Macro variable states was missing or not an array; imported as empty.",
    );
  });

  it("skips orphaned thread macro variable states but keeps global state", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: [],
      id: "messenger-thread-imported",
      now,
      title: "Imported",
    });
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [],
        loreRuntimeStates: [],
        macroVariableStates: [
          {
            id: "macro-variable-state-imported",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "messenger-thread-imported",
            variables: { mood: "calm" },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "macro-variable-state-orphaned",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "missing-thread",
            variables: { hidden: "yes" },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "macro-variable-state-global",
            schemaVersion: 1,
            ownerKind: "global",
            ownerId: "global",
            variables: { day: "Tuesday" },
            createdAt: now,
            updatedAt: now,
          },
        ],
        providerConnections: [],
        messengerThreads: [thread],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.macroVariableStates.map((state) => state.id)).toEqual([
      "macro-variable-state-imported",
      "macro-variable-state-global",
    ]);
    expect(result.preview.counts.macroVariableStates).toBe(2);
    expect(result.preview.counts.macroVariables).toBe(2);
    expect(result.preview.warnings).toContain(
      "Macro variable states skipped 1 record(s) without an imported owner.",
    );
  });

  it("preserves persona lorebooks and global lore settings in native bundles", () => {
    const persona = createPersonaRecord({
      id: "persona-1",
      input: {
        displayName: "Alex",
        lorebookIds: ["persona-lore"],
      },
      now,
    });
    const bundle = createDeKoiStorageBundle({
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        globalLorebookIds: ["global-lore"],
        loreInsertionStrategy: "global-first",
      },
      characters: [],
      roleplayThreads: [],
      personas: [persona],
      lorebooks: [],
      promptPresets: [],
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      messengerThreads: [],
      rippleStates: [],
    });
    const result = normalizeDeKoiStorageBundle(bundle);

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(bundle.data.personas[0]?.lorebookIds).toEqual(["persona-lore"]);
    expect(bundle.data.appSettings.globalLorebookIds).toEqual(["global-lore"]);
    expect(bundle.data.appSettings.loreInsertionStrategy).toBe("global-first");
    expect(result.preview.bundle.data.personas[0]?.lorebookIds).toEqual(["persona-lore"]);
    expect(result.preview.bundle.data.appSettings.globalLorebookIds).toEqual(["global-lore"]);
    expect(result.preview.bundle.data.appSettings.loreInsertionStrategy).toBe("global-first");
  });
});
