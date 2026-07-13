import { expect, test } from "@playwright/test";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import {
  attachMessengerMessagesToThreads,
  extractMessengerMessages,
  toMessengerThreadRecord,
} from "../../src/engine/contracts/types/messenger";
import {
  attachRoleplayEntriesToThreads,
  extractRoleplayEntries,
  toRoleplayThreadRecord,
} from "../../src/engine/contracts/types/roleplay";
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
import { STARTER_PROMPT_PRESET } from "../../src/engine/prompt-presets/starter-preset";
import {
  connectRemoteRuntime,
  installDeferredReplaceRemoteRuntime,
  installFailingRemoteRuntime,
  installRemoteRuntime,
  openDataAndBackupSettings,
  TEST_RUNTIME_URL,
} from "./app-test-utils";

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
    "app-settings": [
      {
        ...DEFAULT_APP_SETTINGS,
        defaultPromptPresetId: STARTER_PROMPT_PRESET.id,
        promptPresetStarterInitialized: true,
      },
    ],
    "messenger-threads": [messengerWithEmbeddedMessage],
    "prompt-presets": [STARTER_PROMPT_PRESET],
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
