import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { appStorageReplaceResultNeedsReload } from "../../src/app/app-storage-import-recovery";
import {
  createStorageReloadBlockToken,
  decideAppStorageReload,
  getValidStorageReloadBlockConfirmation,
  reconcileMigrationAppStorageSignatures,
  type AppStorageCollectionSignatures,
} from "../../src/app/use-app-storage-sync";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createMessengerThread,
} from "../../src/engine/modes/messenger/messenger-actions";
import {
  attachMessengerMessagesToThreads,
  extractMessengerMessages,
  toMessengerThreadRecord,
  type MessengerThread,
} from "../../src/engine/contracts/types/messenger";
import type { ProviderConnectionRecord } from "../../src/engine/contracts/types/provider-connection";
import {
  appendRoleplayEntries,
  createNarrationRoleplayEntry,
  createRoleplayThread,
} from "../../src/engine/modes/roleplay/roleplay-actions";
import {
  attachRoleplayEntriesToThreads,
  extractRoleplayEntries,
  toRoleplayThreadRecord,
} from "../../src/engine/contracts/types/roleplay";
import {
  APP_STORAGE_COLLECTION_KEYS,
  describeGenerationFailureNotice,
  formatGenerationReadinessFailure,
  getGenerationConnectionReadiness,
  saveAppStorageCollections,
  type AppStorageMetadata,
  type AppStorageRecords,
  type AppStorageReplaceResult,
} from "../../src/features/runtime";
import { createHostStorageMetadataResult } from "../../src/runtime/storage/host-storage";
import { HOST_STORAGE_ENTITIES } from "../../src/runtime/storage/storage-entities";
import {
  changedAppStorageMetadataKeys,
  createDeKoiStorageBundle,
  createDeKoiStorageBundleFingerprint,
  normalizeDeKoiStorageBundle,
} from "../../src/runtime";
import { normalizeProviderConnectionRecord } from "../../src/runtime/storage/collections/provider-connection-storage";
import { CHAT_SETTINGS_DRAWER_DEFAULTS } from "../../src/features/shell/shoal/lib/chat-settings-drawers";
import { getChatSettingsMessengerDrawerModels } from "../../src/features/shell/shoal/lib/chat-settings-messenger-drawer-models";
import { getChatSettingsViewModel } from "../../src/features/shell/shoal/lib/chat-settings-view-model";
import { getGenerationNoticeAction } from "../../src/features/modes/shared/generation-notice-actions";
import {
  getMessengerThreadReferenceNotices,
  getMessengerThreadReferenceSummary,
  getMessengerThreadSendBlocker,
} from "../../src/features/modes/messenger/lib/thread-reference-summary";
import {
  getRoleplayThreadReferenceNotices,
  getRoleplayThreadReferenceSummary,
  getRoleplayThreadSendBlocker,
} from "../../src/features/modes/roleplay/lib/thread-reference-summary";

const TEST_RUNTIME_URL = "http://dekoi-runtime.test";
const STORAGE_ENTITIES = HOST_STORAGE_ENTITIES;
const STORAGE_ENTITY_SET = new Set<string>(STORAGE_ENTITIES);

type StorageEntity = (typeof STORAGE_ENTITIES)[number];
type RuntimeCall = {
  command: string;
  entity: StorageEntity | null;
};
type RuntimeRecords = Partial<Record<StorageEntity, unknown[]>>;

function createChatSettingsViewModel(activeMessengerThread: MessengerThread | null) {
  return getChatSettingsViewModel({
    activeMessengerThread,
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [],
  });
}

function createOpenChatSettingsDrawers() {
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

function jsonFilePayload(name: string, value: unknown) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  };
}

async function installRemoteRuntime(page: Page, initialRecords: RuntimeRecords = {}) {
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

async function installDeferredListRemoteRuntime(
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

async function openDataAndBackupSettings(page: Page) {
  await page.goto("/");
  await page.locator(".settings-button").click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
}

async function connectRemoteRuntime(page: Page) {
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
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
      loreRuntimeStates: [],
      macroVariableStates: [],
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

function createEmptyAppStorageRecords(): AppStorageRecords {
  return {
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    personas: [],
    lorebooks: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    roleplayThreads: [],
    messengerThreads: [],
    rippleStates: [],
  };
}

function createTestStorageSignatures(signature: string): AppStorageCollectionSignatures {
  return Object.fromEntries(
    APP_STORAGE_COLLECTION_KEYS.map((collectionKey) => [collectionKey, signature]),
  ) as AppStorageCollectionSignatures;
}

function expectReloadAfterPartialReplace(calls: RuntimeCall[], callsBeforeImport: number) {
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
    importCalls.slice(failedReplaceIndex + 1).filter((call) => call.command === "storage_list"),
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

test("chat settings drawer models align active state with open state", () => {
  const openDrawers = createOpenChatSettingsDrawers();
  const inactiveModels = getChatSettingsMessengerDrawerModels({
    appSettings: DEFAULT_APP_SETTINGS,
    settings: {
      activeMessengerThread: null,
      activeMessengerThreadId: null,
      chatSettingsViewModel: createChatSettingsViewModel(null),
      companionSelectorOpen: true,
      openDrawers,
    },
    settingsLabel: "Messenger Settings",
  });

  expect(inactiveModels.advanced.open).toBe(false);
  expect(inactiveModels.identity.connection.open).toBe(false);
  expect(inactiveModels.identity.persona.open).toBe(false);
  expect(inactiveModels.resources.companion.open).toBe(false);
  expect(inactiveModels.resources.lorebook.open).toBe(false);
  expect(inactiveModels.resources.prompt.open).toBe(false);

  const activeMessengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "thread-1",
    now: "2026-01-01T00:00:00.000Z",
    title: "Messenger",
  });
  const activeModels = getChatSettingsMessengerDrawerModels({
    appSettings: DEFAULT_APP_SETTINGS,
    settings: {
      activeMessengerThread,
      activeMessengerThreadId: activeMessengerThread.id,
      chatSettingsViewModel: createChatSettingsViewModel(activeMessengerThread),
      companionSelectorOpen: true,
      openDrawers,
    },
    settingsLabel: "Messenger Settings",
  });

  expect(activeModels.advanced.open).toBe(true);
  expect(activeModels.identity.connection.open).toBe(true);
  expect(activeModels.identity.persona.open).toBe(true);
  expect(activeModels.resources.companion.open).toBe(true);
  expect(activeModels.resources.lorebook.open).toBe(true);
  expect(activeModels.resources.prompt.open).toBe(true);
});

test("messenger thread reference summary flags missing settings before send", () => {
  const readyProviderConnection = {
    id: "connection-ready",
    schemaVersion: 1,
    kind: "provider",
    provider: "custom",
    label: "Ready Connection",
    baseUrl: "http://localhost:11434/v1",
    model: "local-model",
    summary: "",
    status: "ready",
    modelLabel: "local-model",
    agentDefault: false,
    maxContext: null,
    maxOutput: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies ProviderConnectionRecord;
  const activeMessengerThread = createMessengerThread({
    activePersonaId: "persona-missing",
    characterIds: ["companion-missing"],
    id: "thread-missing-references",
    lorebookIds: ["lorebook-missing"],
    now: "2026-01-01T00:00:00.000Z",
    providerConnectionId: "connection-missing",
    title: "Missing References",
  });
  const summary = getMessengerThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [],
    thread: activeMessengerThread,
  });

  expect(summary).toEqual(
    expect.objectContaining({
      hasMissingConnection: true,
      hasMissingPersona: true,
      hasNoConnectionAvailable: true,
      missingCompanionCount: 1,
      missingLorebookCount: 1,
      selectedCompanionCount: 0,
    }),
  );
  expect(getMessengerThreadSendBlocker(summary)).toContain("Create a connection");
  expect(getMessengerThreadReferenceNotices(summary).map((notice) => notice.id)).toEqual([
    "no-connection",
    "no-companion",
    "missing-persona",
    "missing-lorebooks",
  ]);

  const companionBlockerSummary = getMessengerThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [readyProviderConnection],
    thread: {
      ...activeMessengerThread,
      providerConnectionId: readyProviderConnection.id,
    },
  });
  expect(getMessengerThreadSendBlocker(companionBlockerSummary)).toContain(
    "clear missing companions",
  );
});

test("roleplay thread reference summary flags missing settings before send", () => {
  const readyProviderConnection = {
    id: "connection-ready",
    schemaVersion: 1,
    kind: "provider",
    provider: "custom",
    label: "Ready Connection",
    baseUrl: "http://localhost:11434/v1",
    model: "local-model",
    summary: "",
    status: "ready",
    modelLabel: "local-model",
    agentDefault: false,
    maxContext: null,
    maxOutput: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies ProviderConnectionRecord;
  const activeRoleplayThread = createRoleplayThread({
    activePersonaId: "persona-missing",
    characterIds: ["companion-missing"],
    id: "roleplay-missing-references",
    lorebookIds: ["lorebook-missing"],
    now: "2026-01-01T00:00:00.000Z",
    providerConnectionId: "connection-missing",
    title: "Missing References",
  });
  const summary = getRoleplayThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [],
    thread: activeRoleplayThread,
  });

  expect(summary).toEqual(
    expect.objectContaining({
      hasMissingConnection: true,
      hasMissingPersona: true,
      hasNoConnectionAvailable: true,
      missingCompanionCount: 1,
      missingLorebookCount: 1,
      selectedCompanionCount: 0,
    }),
  );
  expect(getRoleplayThreadSendBlocker(summary)).toContain("Create a connection");
  expect(getRoleplayThreadReferenceNotices(summary).map((notice) => notice.id)).toEqual([
    "no-connection",
    "no-companion",
    "missing-persona",
    "missing-lorebooks",
  ]);

  const companionBlockerSummary = getRoleplayThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [readyProviderConnection],
    thread: {
      ...activeRoleplayThread,
      providerConnectionId: readyProviderConnection.id,
    },
  });
  expect(getRoleplayThreadSendBlocker(companionBlockerSummary)).toContain(
    "clear missing companions",
  );
});

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
  const messengerWithMessage = appendMessengerMessages(messengerThread, [messengerMessage]);
  expect(toMessengerThreadRecord(messengerWithMessage)).toEqual(
    toMessengerThreadRecord(messengerThread),
  );
  expect(extractMessengerMessages([messengerWithMessage])).toEqual([messengerMessage]);

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
  const roleplayWithEntry = appendRoleplayEntries(roleplayThread, [roleplayEntry]);
  expect(toRoleplayThreadRecord(roleplayWithEntry)).toEqual(toRoleplayThreadRecord(roleplayThread));
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
  expect(reassembledMessenger[0].messages).toEqual([messengerSecond, messengerFirst]);

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
  expect(reassembledRoleplay[0].entries).toEqual([roleplaySecond, roleplayFirst]);
});

test("legacy embedded transcripts migrate into split collections on load", async ({ page }) => {
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
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [messengerMessage]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [roleplayEntry]);
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
    .toEqual(["roleplay-threads", "roleplay-entries", "messenger-threads", "messenger-messages"]);
  expect(runtime.records.get("messenger-threads")).toEqual([
    toMessengerThreadRecord(messengerWithEmbeddedMessage),
  ]);
  expect(runtime.records.get("messenger-messages")).toEqual([messengerMessage]);
  expect(runtime.records.get("roleplay-threads")).toEqual([
    toRoleplayThreadRecord(roleplayWithEmbeddedEntry),
  ]);
  expect(runtime.records.get("roleplay-entries")).toEqual([roleplayEntry]);
});

test("failed legacy transcript migration remains dirty until retry succeeds", async ({ page }) => {
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
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [messengerMessage]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [roleplayEntry]);
  const runtime = await installFailingRemoteRuntime(page, "roleplay-entries", {
    "messenger-threads": [messengerWithEmbeddedMessage],
    "roleplay-threads": [roleplayWithEmbeddedEntry],
  });

  await openDataAndBackupSettings(page);
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();

  await expect
    .poll(
      () =>
        runtime.calls.filter(
          (call) => call.command === "storage_replace" && call.entity === "roleplay-entries",
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

test("legacy transcript migration success preserves edits made while saving", async ({ page }) => {
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
  const messengerWithEmbeddedMessage = appendMessengerMessages(messengerThread, [messengerMessage]);
  const roleplayWithEmbeddedEntry = appendRoleplayEntries(roleplayThread, [roleplayEntry]);
  const runtime = await installDeferredReplaceRemoteRuntime(page, "roleplay-entries", {
    "messenger-threads": [messengerWithEmbeddedMessage],
    "roleplay-threads": [roleplayWithEmbeddedEntry],
  });

  await openDataAndBackupSettings(page);
  await page.getByLabel("Remote Runtime URL").fill(TEST_RUNTIME_URL);
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
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

test("manual storage reload is blocked while local changes are saving", async ({ page }) => {
  const runtime = await installDeferredReplaceRemoteRuntime(page, "app-settings", {
    "app-settings": [{ id: "app-settings", accent: "koi" }],
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

test("provider connection storage upgrades old runtime-kind rows and skips removed lanes", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const legacyMockConnection = {
    id: "connection-legacy-mock",
    schemaVersion: 1,
    kind: "mock",
    provider: "custom",
    label: "Local mock",
    baseUrl: "",
    model: "Mock adapter",
    summary: "",
    status: "ready",
    modelLabel: "Mock adapter",
    agentDefault: false,
    maxContext: null,
    maxOutput: null,
    createdAt,
    updatedAt: createdAt,
  };
  const oldRuntimeKindConnection = {
    ...legacyMockConnection,
    id: "connection-old-runtime-kind",
    kind: "remote-runtime",
    provider: "openai",
    label: "Remote runtime",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    modelLabel: "gpt-4o-mini",
  };
  const malformedRuntimeKindConnection = {
    ...oldRuntimeKindConnection,
    id: "connection-malformed-runtime-kind",
    provider: "not-a-provider",
  };
  const emptyFieldRuntimeKindConnection = {
    ...oldRuntimeKindConnection,
    id: "connection-empty-field-runtime-kind",
    baseUrl: "",
  };
  const providerConnection = {
    ...legacyMockConnection,
    id: "connection-provider",
    kind: "provider",
    provider: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    modelLabel: "gpt-4o-mini",
  };

  expect(normalizeProviderConnectionRecord(legacyMockConnection)).toBeNull();
  expect(
    normalizeProviderConnectionRecord({
      ...legacyMockConnection,
      id: "connection-legacy-local",
      kind: "local",
      label: "Local adapter",
    }),
  ).toBeNull();
  expect(
    normalizeProviderConnectionRecord({
      ...legacyMockConnection,
      id: "connection-missing-kind",
      kind: undefined,
      label: "Missing kind",
    }),
  ).toBeNull();
  expect(normalizeProviderConnectionRecord(malformedRuntimeKindConnection)).toBeNull();
  expect(normalizeProviderConnectionRecord(emptyFieldRuntimeKindConnection)).toBeNull();
  const upgradedConnection = normalizeProviderConnectionRecord(oldRuntimeKindConnection, {
    preserveReadyStatus: true,
  });
  expect(upgradedConnection).toEqual(
    expect.objectContaining({
      id: "connection-old-runtime-kind",
      kind: "provider",
      provider: "openai",
      label: "Remote runtime",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      status: "ready",
    }),
  );
  expect(
    normalizeProviderConnectionRecord(providerConnection, {
      preserveReadyStatus: true,
    }),
  ).toEqual(
    expect.objectContaining({
      id: "connection-provider",
      kind: "provider",
      provider: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      status: "ready",
    }),
  );

  if (!upgradedConnection) {
    throw new Error("Expected old runtime-kind provider connection to normalize.");
  }

  const thread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "thread-existing-connection",
    now: createdAt,
    providerConnectionId: upgradedConnection.id,
    title: "Existing connection thread",
  });
  const summary = getMessengerThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    providerConnections: [upgradedConnection],
    thread,
  });
  expect(summary).toEqual(
    expect.objectContaining({
      hasMissingConnection: false,
      hasNoConnectionAvailable: false,
    }),
  );
});

test("provider generation readiness blocks desktop-key providers in browser mode", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const keyedConnections = [
    {
      id: "connection-openai",
      provider: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    },
    {
      id: "connection-anthropic",
      provider: "anthropic",
      label: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-5",
    },
  ].map((connection) =>
    normalizeProviderConnectionRecord(
      {
        ...connection,
        schemaVersion: 1,
        kind: "provider",
        summary: "",
        status: "ready",
        modelLabel: connection.model,
        agentDefault: false,
        maxContext: null,
        maxOutput: null,
        createdAt,
        updatedAt: createdAt,
      },
      { preserveReadyStatus: true },
    ),
  );
  const customConnection = normalizeProviderConnectionRecord(
    {
      id: "connection-custom",
      schemaVersion: 1,
      kind: "provider",
      provider: "custom",
      label: "Local custom",
      baseUrl: "http://localhost:11434/v1",
      model: "local-model",
      summary: "",
      status: "ready",
      modelLabel: "local-model",
      agentDefault: false,
      maxContext: null,
      maxOutput: null,
      createdAt,
      updatedAt: createdAt,
    },
    { preserveReadyStatus: true },
  );

  expect(keyedConnections).not.toContain(null);
  expect(customConnection).not.toBeNull();
  if (keyedConnections.some((connection) => connection === null) || !customConnection) {
    throw new Error("Expected test provider connections to normalize.");
  }

  for (const connection of keyedConnections) {
    const blocked = getGenerationConnectionReadiness(connection);
    expect(blocked).toEqual({
      ready: false,
      code: "desktop-key-store-unavailable",
    });
    if (!blocked.ready) {
      expect(formatGenerationReadinessFailure(blocked.code)).toContain("desktop app");
    }
  }

  const ready = getGenerationConnectionReadiness(customConnection);
  expect(ready.ready).toBe(true);
  if (ready.ready) {
    expect(ready.connection.id).toBe("connection-custom");
  }
});

test("provider generation failure notices point to useful recovery", () => {
  expect(getGenerationNoticeAction("new-connection", null)).toEqual({
    kind: "create-connection",
    label: "Create connection",
  });
  expect(getGenerationNoticeAction("connections", "connection-openai")).toEqual({
    kind: "open-connection",
    label: "Open connection",
    connectionId: "connection-openai",
  });
  expect(getGenerationNoticeAction("connections", null)).toEqual({
    kind: "open-connection",
    label: "Open Connections",
    connectionId: null,
  });

  const missingConnection = describeGenerationFailureNotice(
    new Error(
      "Provider Messenger generation failed. Generation needs a configured provider connection.",
    ),
    "Messenger generation failed.",
  );

  expect(missingConnection.message).toContain("provider connection");
  expect(missingConnection.recoveryTarget).toBe("new-connection");

  const rejectedKey = describeGenerationFailureNotice(
    new Error(
      "Provider Messenger generation failed. Provider returned HTTP 401 Unauthorized: invalid_api_key",
    ),
    "Messenger generation failed.",
  );

  expect(rejectedKey.message).toContain("API key");
  expect(rejectedKey.message).toContain("invalid_api_key");
  expect(rejectedKey.recoveryTarget).toBe("connections");

  const unavailableModel = describeGenerationFailureNotice(
    new Error(
      "Provider returned HTTP 400 Bad Request: The selected model is not available for this key.",
    ),
    "Messenger generation failed.",
  );

  expect(unavailableModel.message).toContain("model");
  expect(unavailableModel.message).toContain("not available");
  expect(unavailableModel.recoveryTarget).toBe("connections");

  const rateLimit = describeGenerationFailureNotice(
    "Provider returned HTTP 429 Too Many Requests: rate limit exceeded",
    "Messenger generation failed.",
  );

  expect(rateLimit.message).toContain("rate limit");
  expect(rateLimit.recoveryTarget).toBeUndefined();

  const corsBlocked = describeGenerationFailureNotice(
    "TypeError: CORS request blocked",
    "Messenger generation failed.",
  );

  expect(corsBlocked.message).toContain("Browser provider request was blocked");
  expect(corsBlocked.recoveryTarget).toBe("connections");

  const noText = describeGenerationFailureNotice(
    "Provider returned no text (finish reason: length).",
    "Provider generation did not return a Messenger reply.",
  );

  expect(noText.message).toContain("did not return text");
  expect(noText.recoveryTarget).toBeUndefined();
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
