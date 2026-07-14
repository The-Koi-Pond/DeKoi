import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { createMessengerThread } from "../../src/engine/modes/messenger/messenger-actions";
import { createPromptPresetRecord } from "../../src/engine/prompt-presets/prompt-preset-actions";
import { toModeThreadStorageRecord } from "../../src/runtime/storage/app-storage-collection-projection";
import {
  connectRemoteRuntime,
  installRemoteRuntime,
  openDataAndBackupSettings,
} from "./app-test-utils";

const starterQuestions = [
  "Choose the primary mode.",
  "Choose the content level.",
  "Choose the erotic tone.",
  "Choose how strictly to preserve user agency.",
  "Choose the pacing style.",
  "Choose the prose style.",
  "Choose the narration style.",
  "Choose the narrative perspective.",
  "Choose the tense.",
  "Choose the response length.",
  "Choose the response language.",
];

test("all starter preset variables stay visible and resolve independently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Companions / Personas" }).click();
  await page.getByRole("button", { name: "＋ Companion" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Evidence Companion");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Roleplay", exact: true }).first().click();
  await page.getByRole("button", { name: "+ New Roleplay" }).click();
  await page.getByLabel("Thread Name", { exact: true }).fill("Always Visible Proof");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Preset Variables" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /^Prompt Preset/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const fields = dialog.locator(".preset-variables-field");
  await expect(fields).toHaveCount(starterQuestions.length);
  for (const question of starterQuestions) {
    await expect(dialog.getByText(question, { exact: true }).last()).toBeVisible();
  }

  const evidenceDir = process.env.NO_MISTAKES_EVIDENCE_DIR;
  if (evidenceDir) {
    await page.screenshot({
      path: join(evidenceDir, "preset-variables-all-questions.png"),
      fullPage: true,
    });
  }

  await fields.nth(0).getByRole("button").click();
  await page.getByRole("option", { name: "Roleplayer" }).click();
  await fields.nth(1).getByRole("button").click();
  await page.getByRole("option").filter({ hasText: /^SFW/ }).click();

  await expect(fields.nth(0)).toContainText("Roleplayer");
  await expect(fields.nth(1)).toContainText("SFW");
  await expect(fields.nth(2)).toContainText("Preset default: None");
  await expect(fields).toHaveCount(starterQuestions.length);

  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  const reopenedFields = page
    .getByRole("dialog", { name: "Preset Variables" })
    .locator(".preset-variables-field");
  await expect(reopenedFields).toHaveCount(starterQuestions.length);
  await expect(reopenedFields.nth(0)).toContainText("Roleplayer");
  await expect(reopenedFields.nth(1)).toContainText("SFW");
  await expect(reopenedFields.nth(2)).toContainText("None");

  if (evidenceDir) {
    await page.screenshot({
      path: join(evidenceDir, "preset-variables-independent-selections.png"),
      fullPage: true,
    });
  }
});

test("Messenger confirms its default preset before reopening variables", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Companions / Personas" }).click();
  await page.getByRole("button", { name: "＋ Companion" }).first().click();
  await page.getByLabel("Name", { exact: true }).fill("Messenger Evidence Companion");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Messenger", exact: true }).first().click();
  await page.getByRole("button", { name: "+ Cast a Line" }).click();
  await page.getByLabel("Thread Name", { exact: true }).fill("Messenger Variable Proof");
  await page.getByRole("button", { name: "Companions", exact: true }).click();
  await page.getByRole("option", { name: /Messenger Evidence Companion/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Preset Variables" });
  await expect(dialog).toBeVisible();
  const evidenceDir = process.env.NO_MISTAKES_EVIDENCE_DIR;
  if (evidenceDir) {
    await page.screenshot({
      path: join(evidenceDir, "messenger-first-use-preset-variables.png"),
      fullPage: true,
    });
  }
  await dialog.getByRole("button", { name: "Use Defaults" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: /^Prompt Preset/ }).click();
  const presetDrawer = page.locator("#chat-settings-preset-drawer");
  await expect(presetDrawer.getByRole("button", { name: "Variables", exact: true })).toBeVisible();
  await expect(presetDrawer.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(page.getByText("Advanced Parameters", { exact: true })).toHaveCount(0);
  if (evidenceDir) {
    await page.screenshot({
      path: join(evidenceDir, "messenger-preset-controls-without-overrides.png"),
      fullPage: true,
    });
  }
  await presetDrawer.getByRole("button", { name: "Variables", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".preset-variables-field")).toHaveCount(starterQuestions.length);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("Messenger repairs only existing invalid preset history after storage loads", async ({
  page,
}) => {
  const now = "2026-07-14T00:00:00.000Z";
  const preset = createPromptPresetRecord({
    id: "preset-repair-proof",
    now,
    input: {
      title: "Repair Proof",
      systemPrompt: "Write a reply.",
      choiceBlocks: [
        {
          id: "tone",
          variableName: "tone",
          label: "Tone",
          options: [{ id: "warm", label: "Warm", value: "warm" }],
        },
      ],
    },
  });
  const unconfirmed = toModeThreadStorageRecord(
    createMessengerThread({
      activePersonaId: null,
      characterIds: [],
      defaultPromptPresetId: preset.id,
      id: "messenger-unconfirmed",
      branchId: "messenger-unconfirmed-branch",
      now,
      title: "Unconfirmed",
    }),
  );
  const invalidThread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    defaultPromptPresetId: preset.id,
    id: "messenger-invalid",
    branchId: "messenger-invalid-branch",
    now,
    title: "Invalid history",
  });
  const invalid = toModeThreadStorageRecord({
    ...invalidThread,
    branches: [
      {
        ...invalidThread.branches[0],
        presetChoiceSelectionsByPresetId: {
          [preset.id]: { tone: { kind: "option" as const, optionId: "removed-option" } },
        },
      },
    ],
  });
  const runtime = await installRemoteRuntime(page, {
    "app-settings": [
      {
        ...DEFAULT_APP_SETTINGS,
        defaultPromptPresetId: preset.id,
        promptPresetStarterInitialized: true,
      },
    ],
    "mode-threads": [unconfirmed, invalid],
    "prompt-presets": [preset],
  });

  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);

  await expect
    .poll(
      () =>
        runtime.calls.filter(
          (call) => call.command === "storage_replace" && call.entity === "mode-threads",
        ).length,
      { timeout: 8_000 },
    )
    .toBe(1);
  const storedThreads = runtime.records.get("mode-threads") as Array<{
    id: string;
    branches: Array<{ presetChoiceSelectionsByPresetId: Record<string, unknown> }>;
  }>;
  expect(
    storedThreads.find((thread) => thread.id === unconfirmed.id)?.branches[0]
      .presetChoiceSelectionsByPresetId,
  ).toEqual({});
  expect(
    storedThreads.find((thread) => thread.id === invalid.id)?.branches[0]
      .presetChoiceSelectionsByPresetId,
  ).toEqual({
    [preset.id]: { tone: { kind: "option", optionId: "warm" } },
  });
});
