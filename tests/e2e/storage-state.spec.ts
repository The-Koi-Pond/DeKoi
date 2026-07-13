import { expect, test, type Page } from "@playwright/test";
import { appStorageReplaceResultNeedsReload } from "../../src/app/app-storage-import-recovery";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { STARTER_PROMPT_PRESET } from "../../src/engine/prompt-presets/starter-preset";
import {
  createStorageReloadBlockToken,
  decideAppStorageReload,
  getValidStorageReloadBlockConfirmation,
  reconcileMigrationAppStorageSignatures,
  type AppStorageCollectionSignatures,
} from "../../src/app/use-app-storage-sync";
import {
  saveAppStorageCollections,
  type AppStorageMetadata,
  type AppStorageReplaceResult,
} from "../../src/features/runtime";
import { changedAppStorageMetadataKeys } from "../../src/runtime";
import { createHostStorageMetadataResult } from "../../src/runtime/storage/host-storage";
import {
  connectRemoteRuntime,
  createEmptyAppStorageRecords,
  createTestStorageSignatures,
  installDeferredListRemoteRuntime,
  installDeferredReplaceRemoteRuntime,
  installRemoteRuntime,
  openDataAndBackupSettings,
  TEST_RUNTIME_URL,
} from "./app-test-utils";

async function installDesktopStorageFailures(page: Page, failures: Record<string, string>) {
  await page.addInitScript((collectionFailures) => {
    Object.assign(globalThis, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, payload: Record<string, unknown> = {}) => {
          if (command === "dekoi_runtime_invoke") {
            const runtimeCommand = payload.command;
            const args = payload.args as Record<string, unknown> | null;
            const entity = args?.entity;
            if (runtimeCommand === "storage_list" && typeof entity === "string") {
              const failure = collectionFailures[entity];
              if (failure) throw new Error(failure);
              return [];
            }
            if (runtimeCommand === "storage_replace") {
              const records = Array.isArray(args?.records) ? args.records : [];
              return { ok: true, count: records.length };
            }
          }
          if (command === "dekoi_storage_collection_metadata") return [];
          if (command === "dekoi_host_status") {
            return {
              appName: "DeKoi",
              hostKind: "tauri",
              storageReady: true,
              secretsReady: true,
              runtimeReady: true,
              message: "Desktop host is ready.",
            };
          }
          throw new Error(`Unexpected desktop command: ${command}`);
        },
      },
    });
  }, failures);
}

test("storage import reload decision falls back to completed collections", () => {
  const counts = {
    appSettings: 1,
    characters: 0,
    personas: 0,
    lorebooks: 0,
    loreRuntimeStates: 0,
    macroVariableStates: 0,
    providerConnections: 0,
    roleplayThreads: 0,
    roleplayEntries: 0,
    messengerThreads: 0,
    messengerMessages: 0,
    rippleStates: 0,
  } satisfies AppStorageReplaceResult["counts"];
  const mixedFailure = {
    mode: "remote",
    status: "error",
    message: "Import failed.",
    counts,
    collections: [
      {
        collectionKey: "appSettings",
        count: 1,
        mode: "remote",
        status: "ready",
        message: "Saved.",
        metadata: null,
      },
      {
        collectionKey: "characters",
        count: 0,
        mode: "remote",
        status: "error",
        message: "Failed.",
        metadata: null,
      },
    ],
    failedCollectionKey: "characters",
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage: "Restore from backup.",
    storageMetadata: {},
  } satisfies AppStorageReplaceResult;

  expect(appStorageReplaceResultNeedsReload(mixedFailure)).toBe(true);
  expect(
    appStorageReplaceResultNeedsReload({
      ...mixedFailure,
      collections: [mixedFailure.collections[1]],
    }),
  ).toBe(false);
});

test("storage metadata comparison reports changed collection files", () => {
  const loadedMetadata = {
    characters: {
      entity: "characters",
      exists: true,
      byteLength: 18,
      updatedAtMs: 1,
      contentHash: "fnv1a64:loaded",
    },
  } satisfies AppStorageMetadata;
  const currentMetadata = {
    characters: {
      entity: "characters",
      exists: true,
      byteLength: 22,
      updatedAtMs: 2,
      contentHash: "fnv1a64:current",
    },
  } satisfies AppStorageMetadata;

  expect(changedAppStorageMetadataKeys(loadedMetadata, currentMetadata)).toEqual(["characters"]);
});

test("storage reload decision blocks active work and confirms dirty-only reload", () => {
  const savedSignatures = createTestStorageSignatures("saved");
  const dirtySignatures = {
    ...savedSignatures,
    appSettings: "dirty-first",
  };
  const laterDirtySignatures = {
    ...savedSignatures,
    appSettings: "dirty-later",
  };
  const laterSavedSignatures = {
    ...savedSignatures,
    characters: "saved-later",
  };
  const firstDirtyBlockToken = createStorageReloadBlockToken({
    savedSignatures,
    currentSignatures: dirtySignatures,
  });
  const laterDirtyBlockToken = createStorageReloadBlockToken({
    savedSignatures,
    currentSignatures: laterDirtySignatures,
  });
  const laterSavedBlockToken = createStorageReloadBlockToken({
    savedSignatures: laterSavedSignatures,
    currentSignatures: dirtySignatures,
  });

  expect(firstDirtyBlockToken?.changedCollectionKeys).toEqual(["appSettings"]);
  expect(
    decideAppStorageReload({
      activeStorageWork: true,
      currentBlockToken: null,
      confirmedBlockToken: null,
    }),
  ).toBe("block-active-work");

  expect(
    decideAppStorageReload({
      activeStorageWork: false,
      currentBlockToken: firstDirtyBlockToken,
      confirmedBlockToken: null,
    }),
  ).toBe("confirm-local-discard");

  expect(
    decideAppStorageReload({
      activeStorageWork: false,
      currentBlockToken: firstDirtyBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBe("proceed");
  expect(
    getValidStorageReloadBlockConfirmation({
      currentBlockToken: firstDirtyBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBe(firstDirtyBlockToken);

  expect(firstDirtyBlockToken).not.toEqual(laterDirtyBlockToken);
  expect(
    getValidStorageReloadBlockConfirmation({
      currentBlockToken: laterDirtyBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBeNull();
  expect(
    decideAppStorageReload({
      activeStorageWork: false,
      currentBlockToken: laterDirtyBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBe("confirm-local-discard");

  expect(firstDirtyBlockToken).not.toEqual(laterSavedBlockToken);
  expect(
    getValidStorageReloadBlockConfirmation({
      currentBlockToken: laterSavedBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBeNull();
  expect(
    decideAppStorageReload({
      activeStorageWork: false,
      currentBlockToken: laterSavedBlockToken,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBe("confirm-local-discard");
  expect(
    getValidStorageReloadBlockConfirmation({
      currentBlockToken: null,
      confirmedBlockToken: firstDirtyBlockToken,
    }),
  ).toBeNull();
});

test("partial desktop metadata is not a ready stale-check baseline", () => {
  const result = createHostStorageMetadataResult({
    mode: "desktop",
    collectionMetadata: [
      {
        entity: "characters",
        exists: true,
        byteLength: 16,
        updatedAtMs: 1,
        contentHash: "fnv1a64:ready",
      },
    ],
    metadataErrors: [
      {
        entity: "personas",
        message: "Could not inspect personas.",
      },
    ],
  });

  expect(result.status).toBe("error");
  expect(result.metadataAvailable).toBe(false);
  expect(result.collectionMetadata).toHaveLength(1);
  expect(result.metadataErrors).toHaveLength(1);
  expect(result.message).toContain("personas");
  expect(result.message).toContain("Could not inspect personas.");
});

test("storage save rejects mismatched collection metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        count: 1,
        metadata: {
          entity: "personas",
          exists: true,
          byteLength: 2,
          updatedAtMs: 1,
          contentHash: "fnv1a64:wrong",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const result = await saveAppStorageCollections(
      createEmptyAppStorageRecords(),
      ["appSettings"],
      TEST_RUNTIME_URL,
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain(
      "storage_replace returned metadata for personas, expected app-settings.",
    );
    expect(result.storageMetadata).toEqual({});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("migration signature reconciliation keeps changed migrated collections dirty", () => {
  const savedSignatures = {
    appSettings: "app-settings-saved",
    characters: "characters-saved",
    personas: "personas-saved",
    lorebooks: "lorebooks-saved",
    loreRuntimeStates: "lore-runtime-states-saved",
    macroVariableStates: "macro-variable-states-saved",
    providerConnections: "provider-connections-saved",
    roleplayThreads: "legacy-migration-marker",
    roleplayEntries: "legacy-migration-marker",
    messengerThreads: "messenger-threads-saved",
    messengerMessages: "messenger-messages-saved",
    rippleStates: "ripple-states-saved",
  } satisfies AppStorageCollectionSignatures;
  const committedSignatures = {
    ...savedSignatures,
    roleplayThreads: "roleplay-threads-committed",
    roleplayEntries: "roleplay-entries-committed",
  } satisfies AppStorageCollectionSignatures;
  const currentSignatures = {
    ...committedSignatures,
    roleplayEntries: "roleplay-entries-live-edit",
  } satisfies AppStorageCollectionSignatures;

  const reconciled = reconcileMigrationAppStorageSignatures({
    savedSignatures,
    unsavedSignatures: {
      appSettings: "app-settings-live-edit",
      roleplayThreads: "legacy-migration-marker",
      roleplayEntries: "legacy-migration-marker",
    },
    committedSignatures,
    currentSignatures,
    collectionKeys: ["roleplayThreads", "roleplayEntries"],
  });

  expect(reconciled.savedSignatures).toEqual({
    ...committedSignatures,
    roleplayEntries: "legacy-migration-marker",
  });
  expect(reconciled.unsavedSignatures).toEqual({
    appSettings: "app-settings-live-edit",
    roleplayEntries: "roleplay-entries-live-edit",
  });
});

test("manual storage reload applies current runtime records", async ({ page }) => {
  const runtime = await installRemoteRuntime(page, {
    "app-settings": [{ id: "app-settings", accent: "koi" }],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(
    page.locator(".bundle-status").filter({
      hasText: "Storage metadata is not available for remote runtime targets.",
    }),
  ).toBeVisible();

  runtime.records.set("app-settings", [{ id: "app-settings", accent: "amber" }]);
  await page.getByRole("button", { name: "Reload records" }).click();
  await expect(
    page.locator(".bundle-status").filter({
      hasText: "Reloaded storage from the current runtime target.",
    }),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Appearance/ }).click();
  await expect(page.getByRole("radio", { name: "Amber" })).toBeChecked();
});

test("Pond Care lists every collection that fails during reload", async ({ page }) => {
  const runtime = await installRemoteRuntime(page, {
    "app-settings": [
      {
        ...DEFAULT_APP_SETTINGS,
        accent: "amber",
        defaultPromptPresetId: STARTER_PROMPT_PRESET.id,
        promptPresetStarterInitialized: true,
      },
    ],
    "prompt-presets": [STARTER_PROMPT_PRESET],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  runtime.records.set("app-settings", [
    {
      ...DEFAULT_APP_SETTINGS,
      accent: "jade",
      defaultPromptPresetId: STARTER_PROMPT_PRESET.id,
      promptPresetStarterInitialized: true,
    },
  ]);
  runtime.listFailures.set("app-settings", "App settings failed while loading.");
  runtime.listFailures.set("characters", "Characters failed while loading.");
  runtime.listFailures.set("lorebooks", "Lorebooks failed while loading.");

  await page.getByRole("button", { name: "Reload records" }).click();

  const loadErrors = page.getByRole("alert").filter({ hasText: "Collection load errors" });
  await expect(loadErrors).toContainText("Characters:");
  await expect(loadErrors).toContainText("Characters failed while loading.");
  await expect(loadErrors).toContainText("Lorebooks:");
  await expect(loadErrors).toContainText("Lorebooks failed while loading.");
  await expect(loadErrors).toContainText("App settings:");
  await expect(loadErrors).toContainText("App settings failed while loading.");
  await expect(loadErrors).not.toContainText("Prompt presets:");
  await expect(page.getByText("Reloaded storage from the current runtime target.")).toHaveCount(0);

  await page.getByRole("tab", { name: /Appearance/ }).click();
  await expect(page.getByRole("radio", { name: "Amber" })).toBeChecked();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();

  runtime.listFailures.clear();
  await page.getByRole("button", { name: "Reload records" }).click();
  await expect(loadErrors).toHaveCount(0);
  await expect(
    page
      .getByLabel("Stored collections")
      .getByText("Reloaded storage from the current runtime target."),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Appearance/ }).click();
  await expect(page.getByRole("radio", { name: "Jade" })).toBeChecked();
});

test("Pond Care shows desktop collection load failures without repair metadata", async ({
  page,
}) => {
  await installDesktopStorageFailures(page, {
    characters: "Desktop characters failed while loading.",
    lorebooks: "Desktop lorebooks failed while loading.",
  });

  await openDataAndBackupSettings(page);

  await expect(page.locator(".runtime-status").filter({ hasText: "Desktop host" })).toBeVisible();
  const loadErrors = page.getByRole("alert").filter({ hasText: "Collection load errors" });
  await expect(loadErrors).toContainText("Characters:");
  await expect(loadErrors).toContainText("Desktop characters failed while loading.");
  await expect(loadErrors).toContainText("Lorebooks:");
  await expect(loadErrors).toContainText("Desktop lorebooks failed while loading.");
  await expect(page.getByText("Storage repair options")).toHaveCount(0);
});

test("manual storage reload is blocked while local changes are saving", async ({ page }) => {
  const runtime = await installDeferredReplaceRemoteRuntime(page, "app-settings", {
    "app-settings": [
      {
        ...DEFAULT_APP_SETTINGS,
        defaultPromptPresetId: STARTER_PROMPT_PRESET.id,
        promptPresetStarterInitialized: true,
      },
    ],
    "prompt-presets": [STARTER_PROMPT_PRESET],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await page.getByRole("tab", { name: /Appearance/ }).click();
  await page.getByRole("radio", { name: "Amber" }).click();
  await runtime.waitForDeferredReplace;

  runtime.records.set("app-settings", [{ id: "app-settings", accent: "jade" }]);
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
  await page.getByRole("button", { name: "Reload records" }).click();

  await expect(
    page.getByText(/Reload blocked because DeKoi still has unsaved storage changes\./),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Appearance/ }).click();
  await expect(page.getByRole("radio", { name: "Amber" })).toBeChecked();

  runtime.releaseDeferredReplace();
  await expect
    .poll(() => runtime.records.get("app-settings")?.[0], { timeout: 8000 })
    .toEqual(expect.objectContaining({ accent: "amber" }));
});

test("manual storage reload preserves edits made while reload is loading", async ({ page }) => {
  const runtime = await installDeferredListRemoteRuntime(page, "app-settings", {
    "app-settings": [{ id: "app-settings", accent: "koi" }],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  runtime.records.set("app-settings", [{ id: "app-settings", accent: "jade" }]);
  await page.getByRole("button", { name: "Reload records" }).click();
  await runtime.waitForDeferredList;

  await page.getByRole("tab", { name: /Appearance/ }).click();
  await page.getByRole("radio", { name: "Amber" }).click();
  runtime.releaseDeferredList();

  await expect
    .poll(() => runtime.records.get("app-settings")?.[0], { timeout: 8000 })
    .toEqual(expect.objectContaining({ accent: "amber" }));
  await expect(page.getByRole("radio", { name: "Amber" })).toBeChecked();
});
