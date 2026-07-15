import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { createCharacterRecord } from "../../src/engine/catalog/character-actions";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createGeneratedCompanionMessage,
  createMessengerThread,
} from "../../src/engine/modes/messenger/messenger-actions";
import {
  appendRoleplayMessages,
  createRoleplayThread,
  createSystemRoleplayMessage,
} from "../../src/engine/modes/roleplay/roleplay-actions";
import { projectModeThreadCollections } from "../../src/runtime/storage/app-storage-collection-projection";
import {
  connectRemoteRuntime,
  installRemoteRuntime,
  openDataAndBackupSettings,
} from "./app-test-utils";

test("Messenger and Roleplay render distinctly from unified mode-thread storage", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const now = "2026-07-14T10:00:00.000Z";
  const companion = createCharacterRecord({
    id: "companion-evidence",
    input: { displayName: "Mara" },
    now,
  });

  const messengerBase = createMessengerThread({
    id: "messenger-evidence",
    branchId: "messenger-branch-evidence",
    title: "Unified Messenger Evidence",
    characterIds: [companion.id],
    activePersonaId: null,
    now,
  });
  const messengerThread = appendMessengerMessages(messengerBase, [
    createAnonymousMessengerMessage({
      body: "Are both modes still themselves?",
      id: "messenger-user-message",
      versionId: "messenger-user-version",
      now,
      thread: messengerBase,
    }),
    createGeneratedCompanionMessage({
      body: "Messenger keeps its chat-style conversation.",
      companion,
      id: "messenger-companion-message",
      versionId: "messenger-companion-version",
      now,
      thread: messengerBase,
    }),
  ]);

  const roleplayBase = createRoleplayThread({
    id: "roleplay-evidence",
    branchId: "roleplay-branch-evidence",
    title: "Unified Roleplay Evidence",
    characterIds: [companion.id],
    activePersonaId: null,
    openingCharacter: companion,
    greetingText: "The lanterns wake across the pond.",
    greetingMessageId: "roleplay-greeting-message",
    greetingVersionId: "roleplay-greeting-version",
    now,
  });
  const roleplayThread = appendRoleplayMessages(roleplayBase, [
    createSystemRoleplayMessage({
      body: "A separate roleplay scene continues under the same storage substrate.",
      id: "roleplay-narration-message",
      versionId: "roleplay-narration-version",
      now,
      thread: roleplayBase,
    }),
  ]);

  const projected = projectModeThreadCollections([messengerThread, roleplayThread]);
  const runtime = await installRemoteRuntime(page, {
    "app-settings": [
      {
        ...DEFAULT_APP_SETTINGS,
        defaultPromptPresetId: null,
        promptPresetStarterInitialized: true,
      },
    ],
    characters: [companion],
    "mode-threads": projected.modeThreads,
    "mode-messages": projected.modeMessages,
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await page.getByLabel("Close Settings").click();

  await page.getByRole("button", { name: "Messenger", exact: true }).first().click();
  await page.getByRole("button", { name: "Unified Messenger Evidence — Messenger" }).click();
  await expect(page.getByLabel("Messenger messages")).toBeVisible();
  await expect(page.getByText("Are both modes still themselves?", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Messenger keeps its chat-style conversation.", { exact: true }),
  ).toBeVisible();

  const evidenceDir = process.env.NO_MISTAKES_EVIDENCE_DIR;
  if (evidenceDir) {
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: join(evidenceDir, "unified-messenger-surface.png"),
      fullPage: true,
    });
  }

  await page
    .getByText("Messenger keeps its chat-style conversation.", { exact: true })
    .hover();
  await page.getByLabel("Copy message from Mara").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Messenger keeps its chat-style conversation.");

  await page.getByText("Are both modes still themselves?", { exact: true }).hover();
  await page.getByLabel("Edit message from Anonymous").click();
  const messengerEdit = page.getByLabel("Edit message from Anonymous");
  await expect(messengerEdit).toBeFocused();
  await messengerEdit.fill("Are both extracted surfaces still themselves?");
  await page.getByLabel("Save edited message from Anonymous").click();
  await expect(
    page.getByText("Are both extracted surfaces still themselves?", { exact: true }),
  ).toBeVisible();

  await page
    .getByText("Messenger keeps its chat-style conversation.", { exact: true })
    .hover();
  await page.getByLabel("Delete message from Mara").click();
  const messengerDeleteConfirm = page.getByRole("button", {
    name: "Confirm delete message from Mara",
    exact: true,
  });
  await expect(messengerDeleteConfirm).toBeFocused();
  if (evidenceDir) {
    await page.locator(".messenger-thread").screenshot({
      path: join(evidenceDir, "messenger-delete-confirmation.png"),
    });
  }
  await messengerDeleteConfirm.press("Escape");
  await expect(messengerDeleteConfirm).toBeHidden();
  await expect(
    page.getByText("Messenger keeps its chat-style conversation.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Roleplay", exact: true }).first().click();
  await page.getByRole("button", { name: "Unified Roleplay Evidence — Roleplay" }).click();
  await expect(page.getByLabel("Roleplay scene", { exact: true })).toBeVisible();
  await expect(page.getByText("The lanterns wake across the pond.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A separate roleplay scene continues under the same storage substrate.", {
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByText("A separate roleplay scene continues under the same storage substrate.", {
      exact: true,
    })
    .hover();
  await page.getByLabel("Copy Roleplay entry from System").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("A separate roleplay scene continues under the same storage substrate.");

  await page
    .getByText("A separate roleplay scene continues under the same storage substrate.", {
      exact: true,
    })
    .hover();
  await page.getByLabel("Edit Roleplay entry from System").click();
  const roleplayEdit = page.getByLabel("Edit Roleplay entry from System");
  await expect(roleplayEdit).toBeFocused();
  await roleplayEdit.fill("The separate roleplay scene still owns its entry list.");
  await page.getByLabel("Save edited Roleplay entry from System").click();
  await expect(
    page.getByText("The separate roleplay scene still owns its entry list.", { exact: true }),
  ).toBeVisible();

  await page.getByText("The lanterns wake across the pond.", { exact: true }).hover();
  await page.getByLabel("Delete Roleplay entry from Mara").click();
  const roleplayDeleteConfirm = page.getByRole("button", {
    name: "Confirm delete Roleplay entry from Mara",
    exact: true,
  });
  await expect(roleplayDeleteConfirm).toBeFocused();
  if (evidenceDir) {
    await page.locator(".roleplay-thread").screenshot({
      path: join(evidenceDir, "roleplay-delete-confirmation.png"),
    });
  }
  await roleplayDeleteConfirm.press("Escape");
  await expect(roleplayDeleteConfirm).toBeHidden();
  await expect(page.getByText("The lanterns wake across the pond.", { exact: true })).toBeVisible();

  await expect
    .poll(() => JSON.stringify(runtime.records.get("mode-messages")))
    .toContain("Are both extracted surfaces still themselves?");
  await expect
    .poll(() => JSON.stringify(runtime.records.get("mode-messages")))
    .toContain("The separate roleplay scene still owns its entry list.");

  expect(runtime.calls).toEqual(
    expect.arrayContaining([
      { command: "storage_list", entity: "mode-threads" },
      { command: "storage_list", entity: "mode-messages" },
    ]),
  );
  expect(runtime.records.get("mode-threads")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: messengerThread.id, kind: "messenger" }),
      expect.objectContaining({ id: roleplayThread.id, kind: "roleplay" }),
    ]),
  );
  expect(runtime.records.get("mode-messages")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "messenger-user-message" }),
      expect.objectContaining({ id: "messenger-companion-message" }),
      expect.objectContaining({ id: "roleplay-greeting-message" }),
      expect.objectContaining({ id: "roleplay-narration-message" }),
    ]),
  );

  if (evidenceDir) {
    await page.screenshot({
      path: join(evidenceDir, "unified-roleplay-surface.png"),
      fullPage: true,
    });
    await writeFile(
      join(evidenceDir, "unified-mode-thread-storage.json"),
      `${JSON.stringify(
        {
          collectionsLoaded: ["mode-threads", "mode-messages"],
          modeThreads: runtime.records.get("mode-threads"),
          modeMessages: runtime.records.get("mode-messages"),
          observedSurfaces: {
            messenger: "Messenger messages",
            roleplay: "Roleplay scene",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
});
