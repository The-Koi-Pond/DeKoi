/**
 * Shared fixtures and runtime stubs for the split Playwright app specs.
 *
 * Keep helpers here when multiple `tests/e2e/*.spec.ts` files need the same
 * storage/runtime shape; spec-specific setup should stay beside its spec.
 */
import { Buffer } from "node:buffer";
import { expect, type Page } from "@playwright/test";
import { type AppStorageCollectionSignatures } from "../../src/app/use-app-storage-sync";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import {
  type MessengerMessage,
  type MessengerThread,
} from "../../src/engine/contracts/types/messenger";
import { type RoleplayEntry } from "../../src/engine/contracts/types/roleplay";
import { APP_STORAGE_COLLECTION_KEYS, type AppStorageRecords } from "../../src/features/runtime";
import { CHAT_SETTINGS_DRAWER_DEFAULTS } from "../../src/features/shell/shoal/lib/chat-settings-drawers";
import { getChatSettingsViewModel } from "../../src/features/shell/shoal/lib/chat-settings-view-model";
import { HOST_STORAGE_ENTITIES } from "../../src/runtime/storage/storage-entities";

export const TEST_RUNTIME_URL = "http://dekoi-runtime.test";
const STORAGE_ENTITIES = HOST_STORAGE_ENTITIES;
const STORAGE_ENTITY_SET = new Set<string>(STORAGE_ENTITIES);

export type StorageEntity = (typeof STORAGE_ENTITIES)[number];
export type RuntimeCall = {
  command: string;
  entity: StorageEntity | null;
};
export type RuntimeRecords = Partial<Record<StorageEntity, unknown[]>>;

type EmptyAppStorageRecordsFixture = AppStorageRecords & {
  roleplayEntries: RoleplayEntry[];
  messengerMessages: MessengerMessage[];
};

export function createChatSettingsViewModel(activeMessengerThread: MessengerThread | null) {
  return getChatSettingsViewModel({
    activeMessengerThread,
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [],
  });
}

export function createOpenChatSettingsDrawers() {
  return Object.fromEntries(
    Object.keys(CHAT_SETTINGS_DRAWER_DEFAULTS).map((drawerId) => [drawerId, true]),
  ) as typeof CHAT_SETTINGS_DRAWER_DEFAULTS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStorageEntity(value: unknown): value is StorageEntity {
  return typeof value === "string" && STORAGE_ENTITY_SET.has(value);
}

export function jsonFilePayload(name: string, value: unknown) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  };
}

export async function installRemoteRuntime(page: Page, initialRecords: RuntimeRecords = {}) {
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
    const command = isRecord(parsed) && typeof parsed.command === "string" ? parsed.command : "";
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

export async function installFailingRemoteRuntime(
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
    const command = isRecord(parsed) && typeof parsed.command === "string" ? parsed.command : "";
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

export async function installDeferredReplaceRemoteRuntime(
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
    const command = isRecord(parsed) && typeof parsed.command === "string" ? parsed.command : "";
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

export async function installDeferredListRemoteRuntime(
  page: Page,
  deferListEntity: StorageEntity,
  initialRecords: RuntimeRecords = {},
) {
  const calls: RuntimeCall[] = [];
  const records = new Map<StorageEntity, unknown[]>();
  for (const [entity, entityRecords] of Object.entries(initialRecords)) {
    if (isStorageEntity(entity)) {
      records.set(entity, entityRecords);
    }
  }

  let deferredListCount = 0;
  let releaseDeferredList: (() => void) | null = null;
  let deferredListStarted: (() => void) | null = null;
  const waitForDeferredList = new Promise<void>((resolve) => {
    deferredListStarted = resolve;
  });

  await page.route(`${TEST_RUNTIME_URL}/api/invoke`, async (route) => {
    const parsed = JSON.parse(route.request().postData() ?? "{}") as unknown;
    const args = isRecord(parsed) && isRecord(parsed.args) ? parsed.args : {};
    const command = isRecord(parsed) && typeof parsed.command === "string" ? parsed.command : "";
    const entity = isStorageEntity(args.entity) ? args.entity : null;
    calls.push({ command, entity });

    if (command === "storage_list" && entity) {
      if (entity === deferListEntity) {
        deferredListCount += 1;
        if (deferredListCount === 2) {
          deferredListStarted?.();
          await new Promise<void>((resolve) => {
            releaseDeferredList = resolve;
          });
        }
      }

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

  return {
    calls,
    records,
    waitForDeferredList,
    releaseDeferredList: () => releaseDeferredList?.(),
  };
}

export async function openDataAndBackupSettings(page: Page) {
  await page.goto("/");
  await page.locator(".settings-button").click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
}

export async function connectRemoteRuntime(page: Page) {
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByText(/Remote runtime storage is active\.|Saved through remote runtime\./),
  ).toBeVisible();
}

export function createBundleFixture() {
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
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      messengerThreads: [],
      messengerMessages: [],
      rippleStates: [],
    },
  };
}

export function createLegacyImportFixture() {
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

export function createEmptyAppStorageRecords(): EmptyAppStorageRecordsFixture {
  return {
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    roleplayThreads: [],
    roleplayEntries: [],
    messengerThreads: [],
    messengerMessages: [],
    rippleStates: [],
  };
}

export function createTestStorageSignatures(signature: string): AppStorageCollectionSignatures {
  return Object.fromEntries(
    APP_STORAGE_COLLECTION_KEYS.map((collectionKey) => [collectionKey, signature]),
  ) as AppStorageCollectionSignatures;
}

export function expectReloadAfterPartialReplace(calls: RuntimeCall[], callsBeforeImport: number) {
  const importCalls = calls.slice(callsBeforeImport);
  const replaceEntities = importCalls
    .filter((call) => call.command === "storage_replace")
    .map((call) => call.entity);
  expect(replaceEntities.slice(0, 3)).toEqual(["prompt-presets", "app-settings", "characters"]);

  const failedReplaceIndex = importCalls.findIndex(
    (call) => call.command === "storage_replace" && call.entity === "characters",
  );
  expect(failedReplaceIndex).toBeGreaterThanOrEqual(0);
  expect(
    importCalls.slice(failedReplaceIndex + 1).filter((call) => call.command === "storage_list"),
  ).toHaveLength(STORAGE_ENTITIES.length);
}
