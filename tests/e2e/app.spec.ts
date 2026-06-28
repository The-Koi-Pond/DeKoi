import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { appStorageReplaceResultNeedsReload } from "../../src/app/app-storage-import-recovery";
import type { AppStorageReplaceResult } from "../../src/features/runtime";

const TEST_RUNTIME_URL = "http://dekoi-runtime.test";
const STORAGE_ENTITIES = [
  "app-settings",
  "characters",
  "personas",
  "lorebooks",
  "provider-connections",
  "roleplay-threads",
  "messenger-threads",
  "ripple-states",
] as const;
const STORAGE_ENTITY_SET = new Set<string>(STORAGE_ENTITIES);

type StorageEntity = (typeof STORAGE_ENTITIES)[number];
type RuntimeCall = {
  command: string;
  entity: StorageEntity | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStorageEntity(value: unknown): value is StorageEntity {
  return typeof value === "string" && STORAGE_ENTITY_SET.has(value);
}

function jsonFilePayload(name: string, value: unknown) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  };
}

async function installFailingRemoteRuntime(
  page: Page,
  failReplaceEntity: StorageEntity,
) {
  const calls: RuntimeCall[] = [];
  const records = new Map<StorageEntity, unknown[]>();
  let failedOnce = false;

  await page.route(`${TEST_RUNTIME_URL}/api/invoke`, async (route) => {
    const parsed = JSON.parse(route.request().postData() ?? "{}") as unknown;
    const args = isRecord(parsed) && isRecord(parsed.args) ? parsed.args : {};
    const command =
      isRecord(parsed) && typeof parsed.command === "string"
        ? parsed.command
        : "";
    const entity = isStorageEntity(args.entity) ? args.entity : null;
    calls.push({ command, entity });

    if (command === "storage_list" && entity) {
      await route.fulfill({ json: records.get(entity) ?? [] });
      return;
    }

    if (command === "storage_replace" && entity) {
      const nextRecords = Array.isArray(args.records) ? args.records : [];
      if (entity === failReplaceEntity && !failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 500,
          json: { message: `Simulated ${entity} replace failure.` },
        });
        return;
      }

      records.set(entity, nextRecords);
      await route.fulfill({ json: { ok: true, count: nextRecords.length } });
      return;
    }

    await route.fulfill({
      status: 400,
      json: { message: `Unexpected runtime command: ${command}` },
    });
  });

  return { calls };
}

async function openDataAndBackupSettings(page: Page) {
  await page.goto("/");
  await page.locator(".settings-button").click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
}

async function connectRemoteRuntime(page: Page) {
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page
    .locator("form.runtime-panel")
    .getByRole("button", { name: "Apply" })
    .click();
  await expect(
    page.getByText("Remote runtime storage is active."),
  ).toBeVisible();
}

function createBundleFixture() {
  return {
    kind: "dekoi.storage-bundle",
    schemaVersion: 1,
    exportedAt: "2026-06-28T00:00:00.000Z",
    data: {
      appSettings: { accent: "amber" },
      characters: [],
      roleplayThreads: [],
      personas: [],
      lorebooks: [],
      providerConnections: [],
      messengerThreads: [],
      rippleStates: [],
    },
  };
}

function createLegacyImportFixture() {
  return {
    threads: [
      {
        kind: "messenger",
        id: "legacy-thread-1",
        title: "Legacy Thread",
        messages: [
          {
            id: "legacy-message-1",
            body: "Imported message",
            author: { label: "Imported" },
            createdAt: "2026-06-28T00:00:00.000Z",
            updatedAt: "2026-06-28T00:00:00.000Z",
          },
        ],
      },
    ],
  };
}

function expectReloadAfterPartialReplace(
  calls: RuntimeCall[],
  callsBeforeImport: number,
) {
  const importCalls = calls.slice(callsBeforeImport);
  const replaceEntities = importCalls
    .filter((call) => call.command === "storage_replace")
    .map((call) => call.entity);
  expect(replaceEntities.slice(0, 2)).toEqual(["app-settings", "characters"]);

  const failedReplaceIndex = importCalls.findIndex(
    (call) => call.command === "storage_replace" && call.entity === "characters",
  );
  expect(failedReplaceIndex).toBeGreaterThanOrEqual(0);
  expect(
    importCalls
      .slice(failedReplaceIndex + 1)
      .filter((call) => call.command === "storage_list"),
  ).toHaveLength(STORAGE_ENTITIES.length);
}

test("app shell renders the primary DeKoi surfaces", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.locator("main.pond")).toBeVisible();
  const surfaceDock = page.getByRole("navigation", { name: "Surface dock" });
  await expect(surfaceDock).toBeVisible();
  await expect(surfaceDock.getByRole("button", { name: "Messenger" })).toBeVisible();
  await expect(surfaceDock.getByRole("button", { name: "Roleplay" })).toBeVisible();
  await expect(surfaceDock.getByRole("button", { name: /Reserved/ })).toBeVisible();

  const modePools = page.locator(".pools");
  await expect(modePools.getByRole("button", { name: "Messenger" })).toBeVisible();
  await expect(modePools.getByRole("button", { name: "Roleplay" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("storage import reload decision falls back to completed collections", () => {
  const counts = {
    appSettings: 1,
    characters: 0,
    personas: 0,
    lorebooks: 0,
    providerConnections: 0,
    roleplayThreads: 0,
    messengerThreads: 0,
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
      },
      {
        collectionKey: "characters",
        count: 0,
        mode: "remote",
        status: "error",
        message: "Failed.",
      },
    ],
    failedCollectionKey: "characters",
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage: "Restore from backup.",
  } satisfies AppStorageReplaceResult;

  expect(appStorageReplaceResultNeedsReload(mixedFailure)).toBe(true);
  expect(
    appStorageReplaceResultNeedsReload({
      ...mixedFailure,
      collections: [mixedFailure.collections[1]],
    }),
  ).toBe(false);
});

test("bundle import failure reloads partial storage and requires fresh confirmation", async ({
  page,
}) => {
  const runtime = await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page.locator("#dekoi-bundle-file").setInputFiles(
    jsonFilePayload("bundle.json", createBundleFixture()),
  );
  await expect(page.getByText("Import preview", { exact: true })).toBeVisible();
  const importButton = page.getByRole("button", { name: "Import bundle" });
  const confirmCheckbox = page.getByLabel(
    "Replace current DeKoi records with this bundle",
  );
  await expect(importButton).toBeDisabled();
  await confirmCheckbox.check();
  await expect(importButton).toBeEnabled();

  const callsBeforeImport = runtime.calls.length;
  await importButton.click();
  await expect(page.getByText(/Import failed\./)).toBeVisible();
  await expect(
    page.locator(".bundle-status").filter({
      hasText: /Persisted storage was reloaded/,
    }),
  ).toBeVisible();
  expectReloadAfterPartialReplace(runtime.calls, callsBeforeImport);
  await expect(confirmCheckbox).not.toBeChecked();
  await expect(importButton).toBeDisabled();

  await page.getByRole("button", { name: "Acknowledge import failure" }).click();
  await page.getByLabel("Close Settings").click();
  await expect(page.locator("aside.care")).not.toHaveClass(/open/);
  await page.locator(".settings-button").click();
  await expect(confirmCheckbox).not.toBeChecked();
  await expect(importButton).toBeDisabled();
});

test("legacy import failure can be acknowledged without arming retry", async ({
  page,
}) => {
  await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page.locator("#legacy-thread-file").setInputFiles(
    jsonFilePayload("legacy.json", createLegacyImportFixture()),
  );
  await expect(page.getByText("Legacy import preview")).toBeVisible();
  const importButton = page.getByRole("button", {
    name: "Import converted records",
  });
  const confirmCheckbox = page.getByLabel("Add converted records to DeKoi");
  await expect(importButton).toBeDisabled();
  await confirmCheckbox.check();
  await expect(importButton).toBeEnabled();

  await importButton.click();
  await expect(page.getByText(/Legacy import failed\./)).toBeVisible();
  await expect(confirmCheckbox).not.toBeChecked();
  await expect(importButton).toBeDisabled();

  await page.getByRole("button", { name: "Acknowledge import failure" }).click();
  await page.getByLabel("Close Settings").click();
  await expect(page.locator("aside.care")).not.toHaveClass(/open/);
  await page.locator(".settings-button").click();
  await expect(confirmCheckbox).not.toBeChecked();
  await expect(importButton).toBeDisabled();
});
