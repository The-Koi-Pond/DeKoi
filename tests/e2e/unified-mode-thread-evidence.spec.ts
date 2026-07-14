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
}) => {
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

  await page.getByRole("button", { name: "Roleplay", exact: true }).first().click();
  await page.getByRole("button", { name: "Unified Roleplay Evidence — Roleplay" }).click();
  await expect(page.getByLabel("Roleplay scene", { exact: true })).toBeVisible();
  await expect(page.getByText("The lanterns wake across the pond.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A separate roleplay scene continues under the same storage substrate.", {
      exact: true,
    }),
  ).toBeVisible();

  expect(runtime.calls).toEqual(
    expect.arrayContaining([
      { command: "storage_list", entity: "mode-threads" },
      { command: "storage_list", entity: "mode-messages" },
    ]),
  );
  expect(runtime.records.get("mode-threads")).toEqual(projected.modeThreads);
  expect(runtime.records.get("mode-messages")).toEqual(projected.modeMessages);

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
