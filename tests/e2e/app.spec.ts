import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { appStorageReplaceResultNeedsReload } from "../../src/app/app-storage-import-recovery";
import {
  reconcileMigrationAppStorageSignatures,
  type AppStorageCollectionSignatures,
} from "../../src/app/use-app-storage-sync";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/app-settings";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createMessengerThread,
} from "../../src/engine/messenger-actions";
import {
  attachMessengerMessagesToThreads,
  extractMessengerMessages,
  toMessengerThreadRecord,
} from "../../src/engine/messenger";
import {
  appendRoleplayEntries,
  createNarrationRoleplayEntry,
  createRoleplayThread,
} from "../../src/engine/roleplay-actions";
import {
  attachRoleplayEntriesToThreads,
  extractRoleplayEntries,
  toRoleplayThreadRecord,
} from "../../src/engine/roleplay";
import type { AppStorageReplaceResult } from "../../src/features/runtime";
import {
  createDeKoiStorageBundle,
  normalizeDeKoiStorageBundle,
} from "../../src/runtime";

const TEST_RUNTIME_URL = "http://dekoi-runtime.test";
const STORAGE_ENTITIES = [
  "app-settings",
  "characters",
  "personas",
  "lorebooks",
  "provider-connections",
  "roleplay-threads",
  "roleplay-entries",
  "messenger-threads",
  "messenger-messages",
  "ripple-states",
] as const;
const STORAGE_ENTITY_SET = new Set<string>(STORAGE_ENTITIES);

type StorageEntity = (typeof STORAGE_ENTITIES)[number];
type RuntimeCall = {
  command: string;
  entity: StorageEntity | null;
};
type RuntimeRecords = Partial<Record<StorageEntity, unknown[]>>;

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

async function installRemoteRuntime(
  page: Page,
  initialRecords: RuntimeRecords = {},
) {
  const calls: RuntimeCall[] = [];
  const records = new Map<StorageEntity, unknown[]>();
  for (const [entity, entityRecords] of Object.entries(initialRecords)) {
    if (isStorageEntity(entity)) {
      records.set(entity, entityRecords);
    }
  }

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
      records.set(entity, nextRecords);
      await route.fulfill({ json: { ok: true, count: nextRecords.length } });
      return;
    }

    await route.fulfill({
      status: 400,
      json: { message: `Unexpected runtime command: ${command}` },
    });
  });

  return { calls, records };
}

async function installFailingRemoteRuntime(
  page: Page,
  failReplaceEntity: StorageEntity,
  initialRecords: RuntimeRecords = {},
) {
  const calls: RuntimeCall[] = [];
  const records = new Map<StorageEntity, unknown[]>();
  for (const [entity, entityRecords] of Object.entries(initialRecords)) {
    if (isStorageEntity(entity)) {
      records.set(entity, entityRecords);
    }
  }
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

  return { calls, records };
}

async function installDeferredReplaceRemoteRuntime(
  page: Page,
  deferReplaceEntity: StorageEntity,
  initialRecords: RuntimeRecords = {},
) {
  const calls: RuntimeCall[] = [];
  const records = new Map<StorageEntity, unknown[]>();
  for (const [entity, entityRecords] of Object.entries(initialRecords)) {
    if (isStorageEntity(entity)) {
      records.set(entity, entityRecords);
    }
  }

  let deferredOnce = false;
  let releaseDeferredReplace: (() => void) | null = null;
  let deferredReplaceStarted: (() => void) | null = null;
  const waitForDeferredReplace = new Promise<void>((resolve) => {
    deferredReplaceStarted = resolve;
  });

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
      if (entity === deferReplaceEntity && !deferredOnce) {
        deferredOnce = true;
        deferredReplaceStarted?.();
        await new Promise<void>((resolve) => {
          releaseDeferredReplace = resolve;
        });
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

  return {
    calls,
    records,
    waitForDeferredReplace,
    releaseDeferredReplace: () => releaseDeferredReplace?.(),
  };
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
    page.getByText(/Remote runtime storage is active\.|Saved through remote runtime\./),
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
      roleplayEntries: [],
      personas: [],
      lorebooks: [],
      providerConnections: [],
      messengerThreads: [],
      messengerMessages: [],
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

test("migration signature reconciliation keeps changed migrated collections dirty", () => {
  const savedSignatures = {
    appSettings: "app-settings-saved",
    characters: "characters-saved",
    personas: "personas-saved",
    lorebooks: "lorebooks-saved",
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

test("transcript edits change transcript projection without changing thread records", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-test",
    now: createdAt,
    title: "Messenger Test",
  });
  const messengerMessage = createAnonymousMessengerMessage({
    body: "Hello",
    id: "messenger-message-test",
    now: messageAt,
    thread: messengerThread,
  });
  const messengerWithMessage = appendMessengerMessages(messengerThread, [
    messengerMessage,
  ]);
  expect(toMessengerThreadRecord(messengerWithMessage)).toEqual(
    toMessengerThreadRecord(messengerThread),
  );
  expect(extractMessengerMessages([messengerWithMessage])).toEqual([
    messengerMessage,
  ]);

  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-test",
    now: createdAt,
    title: "Roleplay Test",
  });
  const roleplayEntry = createNarrationRoleplayEntry({
    body: "Scene beat",
    id: "roleplay-entry-test",
    now: messageAt,
    thread: roleplayThread,
  });
  const roleplayWithEntry = appendRoleplayEntries(roleplayThread, [
    roleplayEntry,
  ]);
  expect(toRoleplayThreadRecord(roleplayWithEntry)).toEqual(
    toRoleplayThreadRecord(roleplayThread),
  );
  expect(extractRoleplayEntries([roleplayWithEntry])).toEqual([roleplayEntry]);
});

test("split transcript reassembly preserves persisted array order", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-order",
    now: createdAt,
    title: "Messenger Order",
  });
  const messengerSecond = createAnonymousMessengerMessage({
    body: "Second in saved order",
    id: "messenger-message-b",
    now: createdAt,
    thread: messengerThread,
  });
  const messengerFirst = createAnonymousMessengerMessage({
    body: "First in saved order",
    id: "messenger-message-a",
    now: createdAt,
    thread: messengerThread,
  });
  const reassembledMessenger = attachMessengerMessagesToThreads(
    [toMessengerThreadRecord(messengerThread)],
    [messengerSecond, messengerFirst],
  );
  expect(reassembledMessenger[0].messages).toEqual([
    messengerSecond,
    messengerFirst,
  ]);

  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-order",
    now: createdAt,
    title: "Roleplay Order",
  });
  const roleplaySecond = createNarrationRoleplayEntry({
    body: "Second in saved order",
    id: "roleplay-entry-b",
    now: createdAt,
    thread: roleplayThread,
  });
  const roleplayFirst = createNarrationRoleplayEntry({
    body: "First in saved order",
    id: "roleplay-entry-a",
    now: createdAt,
    thread: roleplayThread,
  });
  const reassembledRoleplay = attachRoleplayEntriesToThreads(
    [toRoleplayThreadRecord(roleplayThread)],
    [roleplaySecond, roleplayFirst],
  );
  expect(reassembledRoleplay[0].entries).toEqual([
    roleplaySecond,
    roleplayFirst,
  ]);
});

test("legacy embedded transcripts migrate into split collections on load", async ({
  page,
}) => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-legacy",
    now: createdAt,
    title: "Legacy Messenger",
  });
  const messengerMessage = createAnonymousMessengerMessage({
    body: "Legacy message",
    id: "messenger-message-legacy",
    now: messageAt,
    thread: messengerThread,
  });
  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-legacy",
    now: createdAt,
    title: "Legacy Roleplay",
  });
  const roleplayEntry = createNarrationRoleplayEntry({
    body: "Legacy entry",
    id: "roleplay-entry-legacy",
    now: messageAt,
    thread: roleplayThread,
  });
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [
    messengerMessage,
  ]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [
    roleplayEntry,
  ]);
  const runtime = await installRemoteRuntime(page, {
    "messenger-threads": [messengerWithEmbeddedMessage],
    "roleplay-threads": [roleplayWithEmbeddedEntry],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await expect
    .poll(
      () =>
        runtime.calls
          .filter((call) => call.command === "storage_replace")
          .map((call) => call.entity),
      { timeout: 8000 },
    )
    .toEqual([
      "roleplay-threads",
      "roleplay-entries",
      "messenger-threads",
      "messenger-messages",
    ]);
  expect(runtime.records.get("messenger-threads")).toEqual([
    toMessengerThreadRecord(messengerWithEmbeddedMessage),
  ]);
  expect(runtime.records.get("messenger-messages")).toEqual([messengerMessage]);
  expect(runtime.records.get("roleplay-threads")).toEqual([
    toRoleplayThreadRecord(roleplayWithEmbeddedEntry),
  ]);
  expect(runtime.records.get("roleplay-entries")).toEqual([roleplayEntry]);
});

test("failed legacy transcript migration remains dirty until retry succeeds", async ({
  page,
}) => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-retry",
    now: createdAt,
    title: "Retry Messenger",
  });
  const messengerMessage = createAnonymousMessengerMessage({
    body: "Retry message",
    id: "messenger-message-retry",
    now: messageAt,
    thread: messengerThread,
  });
  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-retry",
    now: createdAt,
    title: "Retry Roleplay",
  });
  const roleplayEntry = createNarrationRoleplayEntry({
    body: "Retry entry",
    id: "roleplay-entry-retry",
    now: messageAt,
    thread: roleplayThread,
  });
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [
    messengerMessage,
  ]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [
    roleplayEntry,
  ]);
  const runtime = await installFailingRemoteRuntime(page, "roleplay-entries", {
    "messenger-threads": [messengerWithEmbeddedMessage],
    "roleplay-threads": [roleplayWithEmbeddedEntry],
  });

  await openDataAndBackupSettings(page);
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page
    .locator("form.runtime-panel")
    .getByRole("button", { name: "Apply" })
    .click();

  await expect
    .poll(
      () =>
        runtime.calls.filter(
          (call) =>
            call.command === "storage_replace" &&
            call.entity === "roleplay-entries",
        ).length,
      { timeout: 8000 },
    )
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => runtime.records.get("roleplay-entries"), { timeout: 8000 })
    .toEqual([roleplayEntry]);

  expect(runtime.records.get("messenger-threads")).toEqual([
    toMessengerThreadRecord(messengerWithEmbeddedMessage),
  ]);
  expect(runtime.records.get("messenger-messages")).toEqual([messengerMessage]);
  expect(runtime.records.get("roleplay-threads")).toEqual([
    toRoleplayThreadRecord(roleplayWithEmbeddedEntry),
  ]);
});

test("legacy transcript migration success preserves edits made while saving", async ({
  page,
}) => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const messageAt = "2026-06-28T00:01:00.000Z";
  const messengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "messenger-thread-race",
    now: createdAt,
    title: "Race Messenger",
  });
  const messengerMessage = createAnonymousMessengerMessage({
    body: "Race message",
    id: "messenger-message-race",
    now: messageAt,
    thread: messengerThread,
  });
  const roleplayThread = createRoleplayThread({
    activePersonaId: null,
    characterIds: [],
    id: "roleplay-thread-race",
    now: createdAt,
    title: "Race Roleplay",
  });
  const roleplayEntry = createNarrationRoleplayEntry({
    body: "Race entry",
    id: "roleplay-entry-race",
    now: messageAt,
    thread: roleplayThread,
  });
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [
    messengerMessage,
  ]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [
    roleplayEntry,
  ]);
  const runtime = await installDeferredReplaceRemoteRuntime(
    page,
    "roleplay-entries",
    {
      "messenger-threads": [messengerWithEmbeddedMessage],
      "roleplay-threads": [roleplayWithEmbeddedEntry],
    },
  );

  await openDataAndBackupSettings(page);
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page
    .locator("form.runtime-panel")
    .getByRole("button", { name: "Apply" })
    .click();
  await runtime.waitForDeferredReplace;

  await page.getByRole("tab", { name: /Appearance/ }).click();
  await page.getByRole("radio", { name: "Amber" }).click();
  runtime.releaseDeferredReplace();

  await expect
    .poll(() => runtime.records.get("app-settings")?.[0], { timeout: 8000 })
    .toEqual(expect.objectContaining({ accent: "amber" }));
  expect(runtime.records.get("messenger-threads")).toEqual([
    toMessengerThreadRecord(messengerWithEmbeddedMessage),
  ]);
  expect(runtime.records.get("messenger-messages")).toEqual([messengerMessage]);
  expect(runtime.records.get("roleplay-threads")).toEqual([
    toRoleplayThreadRecord(roleplayWithEmbeddedEntry),
  ]);
  expect(runtime.records.get("roleplay-entries")).toEqual([roleplayEntry]);
});

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
  const messengerWithMessage = appendMessengerMessages(messengerThread, [
    messengerMessage,
  ]);
  const roleplayWithEntry = appendRoleplayEntries(roleplayThread, [
    roleplayEntry,
  ]);

  const bundle = createDeKoiStorageBundle({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    roleplayThreads: [roleplayWithEntry],
    personas: [],
    lorebooks: [],
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
  expect(migrated.preview.bundle.data.messengerMessages).toEqual([
    messengerMessage,
  ]);
  expect(migrated.preview.bundle.data.roleplayEntries).toEqual([roleplayEntry]);
  expect("messages" in migrated.preview.bundle.data.messengerThreads[0]).toBe(
    false,
  );
  expect("entries" in migrated.preview.bundle.data.roleplayThreads[0]).toBe(
    false,
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
  const messengerWithEmbeddedMessages = appendMessengerMessages(
    messengerThread,
    [embeddedMessengerMessage, embeddedOnlyMessengerMessage],
  );

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
      messengerMessages: [
        splitMessengerMessage,
        orphanedSplitMessengerMessage,
      ],
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
