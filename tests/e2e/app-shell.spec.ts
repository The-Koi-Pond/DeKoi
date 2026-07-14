import { expect, test } from "@playwright/test";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { type ProviderConnectionRecord } from "../../src/engine/contracts/types/provider-connection";
import {
  createMessengerThread,
  setMessengerThreadProviderConnection,
} from "../../src/engine/modes/messenger/messenger-actions";
import {
  createRoleplayThread,
  setRoleplayThreadProviderConnection,
} from "../../src/engine/modes/roleplay/roleplay-actions";
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
import { getChatSettingsMessengerDrawerModels } from "../../src/features/shell/shoal/lib/chat-settings-messenger-drawer-models";
import { createChatSettingsViewModel, createOpenChatSettingsDrawers } from "./app-test-utils";

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
    settings: {
      activeMessengerThread: null,
      activeMessengerThreadId: null,
      chatSettingsViewModel: createChatSettingsViewModel(null),
      companionSelectorOpen: true,
      openDrawers,
    },
  });

  expect(inactiveModels).not.toHaveProperty("advanced");
  expect(inactiveModels.identity.connection.open).toBe(false);
  expect(inactiveModels.identity.persona.open).toBe(false);
  expect(inactiveModels.resources.companion.open).toBe(false);
  expect(inactiveModels.resources.lorebook.open).toBe(false);
  expect(inactiveModels.resources.preset.open).toBe(false);

  const activeMessengerThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "thread-1",
    branchId: "thread-1-branch",
    now: "2026-01-01T00:00:00.000Z",
    title: "Messenger",
  });
  const activeModels = getChatSettingsMessengerDrawerModels({
    settings: {
      activeMessengerThread,
      activeMessengerThreadId: activeMessengerThread.id,
      chatSettingsViewModel: createChatSettingsViewModel(activeMessengerThread),
      companionSelectorOpen: true,
      openDrawers,
    },
  });

  expect(activeModels).not.toHaveProperty("advanced");
  expect(activeModels.identity.connection.open).toBe(true);
  expect(activeModels.identity.persona.open).toBe(true);
  expect(activeModels.resources.companion.open).toBe(true);
  expect(activeModels.resources.lorebook.open).toBe(true);
  expect(activeModels.resources.preset.open).toBe(true);
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
    branchId: "thread-missing-references-branch",
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
    promptPresets: [],
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
    promptPresets: [],
    providerConnections: [readyProviderConnection],
    thread: setMessengerThreadProviderConnection(
      activeMessengerThread,
      readyProviderConnection.id,
      "2026-01-01T00:01:00.000Z",
    ),
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
    branchId: "roleplay-missing-references-branch",
    openingCharacter: null,
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
    promptPresets: [],
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
    promptPresets: [],
    providerConnections: [readyProviderConnection],
    thread: setRoleplayThreadProviderConnection(
      activeRoleplayThread,
      readyProviderConnection.id,
      "2026-01-01T00:01:00.000Z",
    ),
  });
  expect(getRoleplayThreadSendBlocker(companionBlockerSummary)).toContain(
    "clear missing companions",
  );
});
