import { expect, test } from "@playwright/test";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { toMessengerThreadRecord } from "../../src/engine/contracts/types/messenger";
import { toRoleplayThreadRecord } from "../../src/engine/contracts/types/roleplay";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createMessengerThread,
} from "../../src/engine/modes/messenger/messenger-actions";
import {
  appendRoleplayEntries,
  createNarrationRoleplayEntry,
  createRoleplayThread,
} from "../../src/engine/modes/roleplay/roleplay-actions";
import {
  createDeKoiStorageBundle,
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

test("storage bundles export split transcripts and migrate embedded transcripts", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-bundle",
    now: createdAt,
    title: "Messenger Bundle",
  });
  const messengerMessage = createAnonymousMessengerMessage({
    body: "Bundle message",
    id: "messenger-message-bundle",
    now: messageAt,
    thread: messengerThread,
  });
  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-bundle",
    now: createdAt,
    title: "Roleplay Bundle",
  });
  const roleplayEntry = createNarrationRoleplayEntry({
    body: "Bundle entry",
    id: "roleplay-entry-bundle",
    now: messageAt,
    thread: roleplayThread,
  });
  const messengerWithMessage = appendMessengerMessages(messengerThread, [messengerMessage]);
  const roleplayWithEntry = appendRoleplayEntries(roleplayThread, [roleplayEntry]);

  const bundle = createDeKoiStorageBundle({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    roleplayThreads: [roleplayWithEntry],
    personas: [],
    lorebooks: [],
    promptPresets: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    messengerThreads: [messengerWithMessage],
    rippleStates: [],
  });
  expect("messages" in bundle.data.messengerThreads[0]).toBe(false);
  expect("entries" in bundle.data.roleplayThreads[0]).toBe(false);
  expect(bundle.data.messengerMessages).toEqual([messengerMessage]);
  expect(bundle.data.roleplayEntries).toEqual([roleplayEntry]);

  const legacyEmbeddedBundle = {
    ...bundle,
    data: {
      ...bundle.data,
      messengerThreads: [messengerWithMessage],
      roleplayThreads: [roleplayWithEntry],
      messengerMessages: undefined,
      roleplayEntries: undefined,
    },
  };
  const migrated = normalizeDeKoiStorageBundle(legacyEmbeddedBundle);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) return;
  expect(migrated.preview.bundle.data.messengerMessages).toEqual([messengerMessage]);
  expect(migrated.preview.bundle.data.roleplayEntries).toEqual([roleplayEntry]);
  expect("messages" in migrated.preview.bundle.data.messengerThreads[0]).toBe(false);
  expect("entries" in migrated.preview.bundle.data.roleplayThreads[0]).toBe(false);
});

test("storage bundle fingerprints track normalized data but ignore export time", () => {
  const bundle = createBundleFixture();
  const preview = normalizeDeKoiStorageBundle(bundle);
  expect(preview.ok).toBe(true);
  if (!preview.ok) return;

  const laterExport = normalizeDeKoiStorageBundle({
    ...bundle,
    exportedAt: "2026-06-29T00:00:00.000Z",
  });
  expect(laterExport.ok).toBe(true);
  if (!laterExport.ok) return;

  const changedData = normalizeDeKoiStorageBundle({
    ...bundle,
    data: {
      ...bundle.data,
      appSettings: { accent: "jade" },
    },
  });
  const undefinedFieldData = normalizeDeKoiStorageBundle({
    ...bundle,
    data: {
      ...bundle.data,
      appSettings: {
        ...bundle.data.appSettings,
        ignored: undefined,
      },
    },
  });
  expect(changedData.ok).toBe(true);
  expect(undefinedFieldData.ok).toBe(true);
  if (!changedData.ok) return;
  if (!undefinedFieldData.ok) return;

  expect(preview.preview.fingerprint).toMatch(/^fnv1a32:/);
  expect(laterExport.preview.fingerprint).toBe(preview.preview.fingerprint);
  expect(undefinedFieldData.preview.fingerprint).toBe(preview.preview.fingerprint);
  expect(changedData.preview.fingerprint).not.toBe(preview.preview.fingerprint);
  expect(createDeKoiStorageBundleFingerprint(preview.preview.bundle)).toBe(
    preview.preview.fingerprint,
  );
});

test("storage bundles merge split transcript rows against final thread records", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const splitAt = "2026-06-28T00:02:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-mixed",
    now: createdAt,
    title: "Mixed Messenger",
  });
  const embeddedMessengerMessage = createAnonymousMessengerMessage({
    body: "Embedded duplicate",
    id: "messenger-message-duplicate",
    now: messageAt,
    thread: messengerThread,
  });
  const embeddedOnlyMessengerMessage = createAnonymousMessengerMessage({
    body: "Embedded fallback",
    id: "messenger-message-embedded",
    now: messageAt,
    thread: messengerThread,
  });
  const splitMessengerMessage = {
    ...embeddedMessengerMessage,
    body: "Split duplicate",
    updatedAt: splitAt,
  };
  const orphanedSplitMessengerMessage = {
    ...embeddedOnlyMessengerMessage,
    body: "Orphaned split duplicate",
    threadId: "missing-messenger-thread",
    updatedAt: splitAt,
  };
  const messengerWithEmbeddedMessages = appendMessengerMessages(messengerThread, [
    embeddedMessengerMessage,
    embeddedOnlyMessengerMessage,
  ]);

  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-mixed",
    now: createdAt,
    title: "Mixed Roleplay",
  });
  const embeddedRoleplayEntry = createNarrationRoleplayEntry({
    body: "Embedded duplicate",
    id: "roleplay-entry-duplicate",
    now: messageAt,
    thread: roleplayThread,
  });
  const embeddedOnlyRoleplayEntry = createNarrationRoleplayEntry({
    body: "Embedded fallback",
    id: "roleplay-entry-embedded",
    now: messageAt,
    thread: roleplayThread,
  });
  const splitRoleplayEntry = {
    ...embeddedRoleplayEntry,
    body: "Split duplicate",
    updatedAt: splitAt,
  };
  const orphanedSplitRoleplayEntry = {
    ...embeddedOnlyRoleplayEntry,
    body: "Orphaned split duplicate",
    threadId: "missing-roleplay-thread",
    updatedAt: splitAt,
  };
  const roleplayWithEmbeddedEntries = appendRoleplayEntries(roleplayThread, [
    embeddedRoleplayEntry,
    embeddedOnlyRoleplayEntry,
  ]);

  const mixedBundle = {
    ...createBundleFixture(),
    data: {
      ...createBundleFixture().data,
      messengerThreads: [messengerWithEmbeddedMessages],
      messengerMessages: [splitMessengerMessage, orphanedSplitMessengerMessage],
      roleplayThreads: [roleplayWithEmbeddedEntries],
      roleplayEntries: [splitRoleplayEntry, orphanedSplitRoleplayEntry],
    },
  };

  const migrated = normalizeDeKoiStorageBundle(mixedBundle);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) return;
  expect(migrated.preview.bundle.data.messengerThreads).toEqual([
    toMessengerThreadRecord(messengerWithEmbeddedMessages),
  ]);
  expect(migrated.preview.bundle.data.messengerMessages).toEqual([
    embeddedOnlyMessengerMessage,
    splitMessengerMessage,
  ]);
  expect(migrated.preview.bundle.data.roleplayThreads).toEqual([
    toRoleplayThreadRecord(roleplayWithEmbeddedEntries),
  ]);
  expect(migrated.preview.bundle.data.roleplayEntries).toEqual([
    embeddedOnlyRoleplayEntry,
    splitRoleplayEntry,
  ]);
  expect(migrated.preview.counts.messengerMessages).toBe(2);
  expect(migrated.preview.counts.roleplayEntries).toBe(2);
  expect(migrated.preview.warnings).toEqual(
    expect.arrayContaining([
      "Messenger messages skipped 1 record(s) without an imported thread.",
      "Roleplay entries skipped 1 record(s) without an imported thread.",
    ]),
  );
});

test("storage bundles warn and skip split transcripts without imported threads", () => {
  const orphanedBundle = {
    ...createBundleFixture(),
    data: {
      ...createBundleFixture().data,
      messengerMessages: [
        {
          id: "messenger-message-orphan",
          schemaVersion: 1,
          threadId: "missing-messenger-thread",
          author: { kind: "unknown", label: "Unknown" },
          body: "Orphaned message",
          origin: "imported",
          createdAt: "2026-06-28T00:00:00.000Z",
          updatedAt: "2026-06-28T00:00:00.000Z",
        },
      ],
      roleplayEntries: [
        {
          id: "roleplay-entry-orphan",
          schemaVersion: 1,
          threadId: "missing-roleplay-thread",
          role: "narration",
          characterId: null,
          personaId: null,
          label: "Narration",
          body: "Orphaned entry",
          origin: "imported",
          createdAt: "2026-06-28T00:00:00.000Z",
          updatedAt: "2026-06-28T00:00:00.000Z",
        },
      ],
    },
  };

  const migrated = normalizeDeKoiStorageBundle(orphanedBundle);
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) return;
  expect(migrated.preview.bundle.data.messengerMessages).toEqual([]);
  expect(migrated.preview.bundle.data.roleplayEntries).toEqual([]);
  expect(migrated.preview.warnings).toEqual(
    expect.arrayContaining([
      "Messenger messages skipped 1 record(s) without an imported thread.",
      "Roleplay entries skipped 1 record(s) without an imported thread.",
    ]),
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
  const importButton = page.getByRole("button", {
    name: "Import converted records",
  });
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
  const importButton = page.getByRole("button", {
    name: "Import converted records",
  });
  await page.getByLabel("Add converted records to DeKoi").check();
  await expect(importButton).toBeEnabled();

  await importButton.click();
  await expect(page.getByText(/Legacy import failed\./)).toBeVisible();
  await expect(page.getByText("Legacy import preview")).toHaveCount(0);
  await expect(importButton).toBeDisabled();
});
