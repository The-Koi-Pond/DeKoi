import { expect, test } from "@playwright/test";
import {
  createDeKoiStorageBundleFingerprint,
  normalizeDeKoiStorageBundle,
} from "../../src/runtime";
import {
  connectRemoteRuntime,
  createBundleFixture,
  createLegacyImportFixture,
  expectReloadAfterPartialReplace,
  installFailingRemoteRuntime,
  jsonFilePayload,
  openDataAndBackupSettings,
} from "./app-test-utils";

test("storage bundle fingerprints track normalized data but ignore export time", () => {
  const bundle = createBundleFixture();
  const preview = normalizeDeKoiStorageBundle(bundle);
  expect(preview.ok).toBe(true);
  if (!preview.ok) return;

  const laterExport = normalizeDeKoiStorageBundle({
    ...bundle,
    exportedAt: "2026-06-29T00:00:00.000Z",
  });
  const changedData = normalizeDeKoiStorageBundle({
    ...bundle,
    data: { ...bundle.data, appSettings: { accent: "jade" } },
  });
  expect(laterExport.ok).toBe(true);
  expect(changedData.ok).toBe(true);
  if (!laterExport.ok || !changedData.ok) return;

  expect(preview.preview.fingerprint).toMatch(/^fnv1a32:/);
  expect(laterExport.preview.fingerprint).toBe(preview.preview.fingerprint);
  expect(changedData.preview.fingerprint).not.toBe(preview.preview.fingerprint);
  expect(createDeKoiStorageBundleFingerprint(preview.preview.bundle)).toBe(
    preview.preview.fingerprint,
  );
});

test("bundle import failure reloads partial storage and requires fresh confirmation", async ({
  page,
}) => {
  const runtime = await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page
    .locator("#dekoi-bundle-file")
    .setInputFiles(jsonFilePayload("bundle.json", createBundleFixture()));
  await expect(page.getByText("Import preview", { exact: true })).toBeVisible();
  const importButton = page.getByRole("button", { name: "Import bundle" });
  const confirmCheckbox = page.getByLabel("Replace current DeKoi records with this bundle");
  await expect(importButton).toBeDisabled();
  await confirmCheckbox.check();
  await expect(importButton).toBeEnabled();

  const callsBeforeImport = runtime.calls.length;
  await importButton.click();
  await expect(page.getByText(/Import failed\./)).toBeVisible();
  await expect(
    page.locator(".bundle-status").filter({ hasText: /Persisted storage was reloaded/ }),
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

test("bundle import failure can restore the in-session pre-import backup", async ({ page }) => {
  const runtime = await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page.getByRole("tab", { name: /Appearance/ }).click();
  await page.getByRole("radio", { name: "Jade" }).click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();

  await page
    .locator("#dekoi-bundle-file")
    .setInputFiles(jsonFilePayload("bundle.json", createBundleFixture()));
  const importButton = page.getByRole("button", { name: "Import bundle" });
  await page.getByLabel("Replace current DeKoi records with this bundle").check();
  await importButton.click();

  await expect(page.getByText(/Import failed\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore pre-import backup" })).toBeVisible();
  await page.getByRole("button", { name: "Restore pre-import backup" }).click();
  await expect(page.getByText(/Restore will replace current DeKoi records/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm restore" }).click();

  await expect(page.getByText(/Restored pre-import backup\./)).toBeVisible();
  await expect
    .poll(() => runtime.records.get("app-settings")?.[0], { timeout: 8000 })
    .toEqual(expect.objectContaining({ accent: "jade" }));
});

test("import recovery is cleared when the storage target changes", async ({ page }) => {
  const runtime = await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page
    .locator("#dekoi-bundle-file")
    .setInputFiles(jsonFilePayload("bundle.json", createBundleFixture()));
  const importButton = page.getByRole("button", { name: "Import bundle" });
  await page.getByLabel("Replace current DeKoi records with this bundle").check();
  await importButton.click();

  await expect(page.getByText(/Import failed\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore pre-import backup" })).toBeVisible();

  await page.getByRole("button", { name: "Use host default" }).click();
  await expect(page.getByRole("button", { name: "Restore pre-import backup" })).toHaveCount(0);
  const restoreReplaceCount = runtime.calls.filter(
    (call) => call.command === "storage_replace",
  ).length;
  await expect
    .poll(() => runtime.calls.filter((call) => call.command === "storage_replace").length)
    .toBe(restoreReplaceCount);
});

test("legacy import failure can be acknowledged without arming retry", async ({ page }) => {
  await installFailingRemoteRuntime(page, "characters");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page
    .locator("#legacy-thread-file")
    .setInputFiles(jsonFilePayload("legacy.json", createLegacyImportFixture()));
  await expect(page.getByText("Legacy import preview")).toBeVisible();
  const importButton = page.getByRole("button", { name: "Import converted records" });
  const confirmCheckbox = page.getByLabel("Add converted records to DeKoi");
  await expect(importButton).toBeDisabled();
  await confirmCheckbox.check();
  await expect(importButton).toBeEnabled();

  await importButton.click();
  await expect(page.getByText(/Legacy import failed\./)).toBeVisible();
  await expect(page.getByText("Legacy import preview")).toHaveCount(0);
  await expect(importButton).toBeDisabled();

  await page.getByRole("button", { name: "Acknowledge legacy import failure" }).click();
  await page.getByLabel("Close Settings").click();
  await expect(page.locator("aside.care")).not.toHaveClass(/open/);
  await page.locator(".settings-button").click();
  await expect(page.getByText("Legacy import preview")).toHaveCount(0);
  await expect(importButton).toBeDisabled();
});

test("legacy import retry requires a fresh preview after partial persistence", async ({ page }) => {
  await installFailingRemoteRuntime(page, "ripple-states");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await page
    .locator("#legacy-thread-file")
    .setInputFiles(jsonFilePayload("legacy.json", createLegacyImportFixture()));
  await expect(page.getByText("Legacy import preview")).toBeVisible();
  const importButton = page.getByRole("button", { name: "Import converted records" });
  await page.getByLabel("Add converted records to DeKoi").check();
  await expect(importButton).toBeEnabled();

  await importButton.click();
  await expect(page.getByText(/Legacy import failed\./)).toBeVisible();
  await expect(page.getByText("Legacy import preview")).toHaveCount(0);
  await expect(importButton).toBeDisabled();
});
