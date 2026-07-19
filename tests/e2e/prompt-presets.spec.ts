import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  connectRemoteRuntime,
  installDeferredReplaceRemoteRuntime,
  installFailingRemoteRuntime,
  installRemoteRuntime,
  openDataAndBackupSettings,
} from "./app-test-utils";

type DelayedFileReadWindow = Window & {
  __delayedPromptPresetRead: {
    started: Promise<void>;
    release: () => void;
  };
};

function promptPresetPackage(id: string, name: string) {
  return {
    type: "marinara_preset",
    version: 1,
    exportedAt: "2026-07-11T00:00:00.000Z",
    data: {
      preset: {
        id,
        name,
        description: "Imported by content.",
        conversationPrompt: "Write the next response.",
        parameters: { temperature: { send: true, value: 0.65 } },
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
      sections: [],
      groups: [],
      choiceBlocks: [],
    },
  };
}

function promptPresetFile(name: string, id: string, presetName: string) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(promptPresetPackage(id, presetName))),
  };
}

function promptlessNativePresetFile(name: string, id: string, presetName: string) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        type: "dekoi_preset",
        version: 2,
        exportedAt: "2026-07-11T00:00:00.000Z",
        data: {
          preset: {
            id,
            schemaVersion: 2,
            name: presetName,
            description: null,
            messengerPrompt: "",
            createdAt: "2026-07-11T00:00:00.000Z",
            updatedAt: "2026-07-11T00:00:00.000Z",
          },
          sections: [],
          groups: [],
          choiceBlocks: [],
        },
      }),
    ),
  };
}

async function installDelayedPromptPresetRead(page: Page, filename: string) {
  await page.addInitScript((delayedFilename) => {
    const originalText = File.prototype.text;
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    (window as DelayedFileReadWindow).__delayedPromptPresetRead = { started, release };
    File.prototype.text = async function (this: File) {
      if (this.name === delayedFilename) {
        markStarted();
        await released;
      }
      return originalText.call(this);
    };
  }, filename);
}

async function waitForDelayedPromptPresetRead(page: Page) {
  await page.evaluate(() => (window as DelayedFileReadWindow).__delayedPromptPresetRead.started);
}

async function releaseDelayedPromptPresetRead(page: Page) {
  await page.evaluate(() => (window as DelayedFileReadWindow).__delayedPromptPresetRead.release());
}

async function waitForRemoteStorageReady(page: Page) {
  await expect(page.locator(".runtime-status.ready").first()).toBeVisible();
}

async function openPromptPresetCatalog(page: Page) {
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Starter Preset" })).toBeVisible();
}

test("prompt preset parameter Send controls retain values and show invalid input", async ({
  page,
}) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await openPromptPresetCatalog(page);
  await page.getByRole("button", { name: "＋ Preset" }).click();

  await page.locator("#preset-name").fill("Parameter Send Proof");
  const temperature = page.getByLabel("Temperature", { exact: true });
  const sendTemperature = page.getByRole("checkbox", { name: "Send Temperature" });
  await temperature.fill("0.65");
  await sendTemperature.check();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await temperature.fill("");
  await expect(page.getByRole("alert")).toContainText("Enter a valid value");
  await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

  await temperature.fill("3");
  await expect(page.getByRole("alert")).toContainText("Enter a value from 0 to 2");
  await expect(page.getByRole("button", { name: "Create" })).toBeDisabled();

  await sendTemperature.uncheck();
  await expect(temperature).toHaveValue("3");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await page.getByRole("button", { name: "Parameter Send Proof" }).click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue("3");
  await expect(page.getByRole("checkbox", { name: "Send Temperature" })).not.toBeChecked();

  await page.getByRole("checkbox", { name: "Send Temperature" }).check();
  await expect(page.getByRole("alert")).toContainText("Enter a value from 0 to 2");
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await page.getByLabel("Temperature", { exact: true }).fill("0.65");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await page.getByRole("button", { name: "Parameter Send Proof" }).click();
  await expect(page.getByLabel("Temperature", { exact: true })).toHaveValue("0.65");
  await expect(page.getByRole("checkbox", { name: "Send Temperature" })).toBeChecked();
});

test("restoring the starter prompt preset opens a fresh record", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  const runtime = await installDeferredReplaceRemoteRuntime(page, "prompt-presets");
  await openPromptPresetCatalog(page);

  const countText = page.locator(".shoal-title .count");
  const beforeCount = await countText.textContent();
  const beforeReplaceCount = runtime.calls.filter(
    (call) => call.command === "storage_replace" && call.entity === "prompt-presets",
  ).length;
  const restore = page.getByRole("button", { name: /Restore Starter Preset|Restoring/ });
  await restore.click();
  await runtime.waitForDeferredReplace;
  await expect(restore).toBeDisabled();
  await expect(restore).toHaveText("Restoring…");
  await expect(countText).toHaveText(beforeCount ?? "");
  await restore.click({ force: true });
  expect(
    runtime.calls.filter(
      (call) => call.command === "storage_replace" && call.entity === "prompt-presets",
    ),
  ).toHaveLength(beforeReplaceCount + 1);
  runtime.releaseDeferredReplace();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await expect(page.locator("#preset-name")).not.toHaveValue("");
});

test("repeated starter restores add distinct records", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await openPromptPresetCatalog(page);

  const countText = page.locator(".shoal-title .count");
  const before = Number((await countText.textContent())?.match(/\d+/)?.[0] ?? 0);
  await page.getByRole("button", { name: "Restore Starter Preset" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await openPromptPresetCatalog(page);
  await page.getByRole("button", { name: "Restore Starter Preset" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await openPromptPresetCatalog(page);
  await expect(countText).toContainText(`${before + 2} stocked`);
});

test("starter restore failure leaves catalog selection unchanged", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await openPromptPresetCatalog(page);
  const countText = page.locator(".shoal-title .count");
  const before = await countText.textContent();
  await installFailingRemoteRuntime(page, "prompt-presets");

  await page.getByRole("button", { name: "Restore Starter Preset" }).click();
  await expect(page.getByRole("alert")).toContainText("Simulated prompt-presets replace failure.");
  await expect(page.getByRole("button", { name: "Restore Starter Preset" })).toBeVisible();
  await expect(countText).toHaveText(before ?? "");
});

test("delayed starter restore from bare Presets does not hijack a newer side rail", async ({
  page,
}) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  const runtime = await installDeferredReplaceRemoteRuntime(page, "prompt-presets");
  await openPromptPresetCatalog(page);

  const countText = page.locator(".shoal-title .count");
  const before = Number((await countText.textContent())?.match(/\d+/)?.[0] ?? 0);
  await page.getByRole("button", { name: "Restore Starter Preset" }).click();
  await runtime.waitForDeferredReplace;
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  runtime.releaseDeferredReplace();

  await expect.poll(() => runtime.records.get("prompt-presets")?.length ?? 0).toBe(before + 1);
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await expect(page.locator(".shoal-title .count")).toContainText(`${before + 1} stocked`);
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes" })).toHaveCount(0);
});

test("prompt preset choice definitions can be authored and saved", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();

  await page.locator("#preset-name").fill("Choice Editor Proof");
  await page.getByLabel("Messenger Prompt").fill("Stay in character.");

  const choiceEditor = page.getByRole("region", { name: "Choice Definitions" });
  await expect(choiceEditor).toBeVisible();
  await choiceEditor.getByRole("button", { name: "Add Choice" }).click();

  await choiceEditor.getByLabel("Variable").fill("tone");
  await choiceEditor.getByLabel("Label", { exact: true }).fill("Tone");
  await choiceEditor.getByLabel("Option Label").fill("Warm");
  await choiceEditor.getByLabel("Value").fill("warm");
  await choiceEditor.getByRole("button", { name: "Add Option" }).click();
  await choiceEditor.getByLabel("Option Label").nth(1).fill("Dry");
  await choiceEditor.getByLabel("Value").nth(1).fill("dry");
  await choiceEditor.getByLabel("Preset default").nth(1).check();

  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await expect(choiceEditor.getByLabel("Variable")).toHaveValue("tone");
  await expect(choiceEditor.getByLabel("Option Label").first()).toHaveValue("Warm");
  await expect(choiceEditor.getByLabel("Option Label").nth(1)).toHaveValue("Dry");
  await expect(choiceEditor.getByLabel("Preset default").nth(1)).toBeChecked();
  expect(pageErrors).toEqual([]);
});

test("promptless prompt presets can be created and reopened", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Promptless Catalog Proof");
  await expect(page.getByLabel("Messenger Prompt")).toHaveValue("");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await expect(page.getByLabel("Messenger Prompt")).toHaveValue("");
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await page.getByRole("button", { name: "Promptless Catalog Proof" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Promptless Catalog Proof");
  await expect(page.getByLabel("Messenger Prompt")).toHaveValue("");
  expect(pageErrors).toEqual([]);
});

test("failed prompt preset create retains the draft and retry persists", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await installFailingRemoteRuntime(page, "prompt-presets");
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Retry Draft");
  await page.getByLabel("Messenger Prompt").fill("Keep this exact text.");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("alert")).toContainText("Simulated prompt-presets replace failure.");
  await expect(page.locator("#preset-name")).toHaveValue("Retry Draft");
  await expect(page.getByLabel("Messenger Prompt")).toHaveValue("Keep this exact text.");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
  await expect(page.locator("#preset-name")).toHaveValue("Retry Draft");
});

test("deferred prompt preset save blocks duplicate clicks and route changes", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  const runtime = await installDeferredReplaceRemoteRuntime(page, "prompt-presets");
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Deferred Draft");
  const save = page.getByRole("button", { name: "Create" });
  await save.click();
  await runtime.waitForDeferredReplace;
  await expect(save).toBeDisabled();
  await expect(page.locator("#preset-name")).toBeDisabled();
  await expect(page.locator("#preset-name")).toHaveValue("Deferred Draft");
  const unloadAllowedWhileSaving = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    return window.dispatchEvent(event);
  });
  expect(unloadAllowedWhileSaving).toBe(false);
  await save.click({ force: true });
  await page.getByRole("button", { name: "Back to Pond" }).click({ force: true });
  await expect(page.locator("#preset-name")).toHaveValue("Deferred Draft");
  await page.locator(".settings-button").click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
  await page.getByLabel("Remote Runtime URL").fill("http://127.0.0.1:7342");
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Deferred Draft");
  await page.getByRole("button", { name: "Close Settings" }).click();
  runtime.releaseDeferredReplace();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
});

test("dirty prompt preset back can cancel or accept discard", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Unsaved Draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Unsaved Draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Back to Pond" }).click();
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
});

test("dirty prompt preset route switch can cancel or accept discard", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Unsaved Route Draft");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Unsaved Route Draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Go to Home" }).click();
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
});

test("dirty prompt preset storage target switch can cancel or accept discard", async ({ page }) => {
  await installRemoteRuntime(page);
  await page.goto("/");
  await openDataAndBackupSettings(page);
  await connectRemoteRuntime(page);
  await waitForRemoteStorageReady(page);
  await page.getByRole("button", { name: "Go to Home" }).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Unsaved Target Draft");
  await page.locator(".settings-button").click();
  await page.getByRole("tab", { name: /Data & Backup/ }).click();
  let noOpDialogCount = 0;
  const dismissUnexpectedNoOpDialog = async (dialog: import("@playwright/test").Dialog) => {
    noOpDialogCount++;
    await dialog.dismiss();
  };
  page.on("dialog", dismissUnexpectedNoOpDialog);
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Unsaved Target Draft");
  expect(noOpDialogCount).toBe(0);
  page.off("dialog", dismissUnexpectedNoOpDialog);
  await page.getByLabel("Remote Runtime URL").fill("http://127.0.0.1:7342");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#preset-name")).toHaveValue("Unsaved Target Draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("form.runtime-panel").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#preset-name")).toHaveCount(0);
});

test("standalone prompt preset files reject bad content and round-trip a fresh native copy", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();

  const stockedCount = page.locator(".shoal-title .count");
  const initialCount = await stockedCount.textContent();
  const fileInput = page.locator(".preset-file-input");

  await expect(page.getByRole("button", { name: "Import JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON" })).toHaveCount(0);

  await page.getByRole("button", { name: "＋ Preset" }).click();
  await expect(page.getByRole("button", { name: "Import JSON" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export JSON" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to Pond" }).click();

  await fileInput.setInputFiles({
    name: "Broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json"),
  });
  await expect(page.getByRole("alert")).toContainText("Prompt preset file must be valid JSON.");
  await expect(stockedCount).toHaveText(initialCount ?? "");

  await fileInput.setInputFiles({
    name: "Bundle.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ type: "dekoi.storage-bundle", schemaVersion: 1 })),
  });
  await expect(page.getByRole("alert")).toContainText(
    "File is not a supported, valid prompt preset package.",
  );
  await expect(stockedCount).toHaveText(initialCount ?? "");

  await fileInput.setInputFiles(
    promptlessNativePresetFile("Portable Proof.json", "preset-portable-source", "Portable Proof"),
  );

  await expect(page.locator("#preset-name")).toHaveValue("Portable Proof");
  await expect(page.getByRole("status")).toHaveText(
    "Imported Portable Proof from Portable Proof.json. Storage is unavailable; this imported preset exists only for this session.",
  );
  await expect(page.getByRole("button", { name: "Import JSON" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

  await page.locator("#preset-name").fill("Portable Proof draft");
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  await expect(page.getByText("Save changes before exporting this preset.")).toBeVisible();
  await page.locator("#preset-name").fill("Portable Proof");
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Portable Proof.json");

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exportedPackage = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    type: string;
    version: number;
    data: { preset: { id: string; name: string } };
  };
  expect(exportedPackage).toMatchObject({
    type: "dekoi_preset",
    version: 2,
    data: { preset: { name: "Portable Proof", messengerPrompt: "" } },
  });
  expect(exportedPackage.data.preset.id).not.toBe("preset-portable-source");
  expect(pageErrors).toEqual([]);
});

test("delayed prompt preset import opens while its Presets rail remains current", async ({
  page,
}) => {
  const filename = "Delayed Current.marinara.json";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installDelayedPromptPresetRead(page, filename);

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page
    .locator(".preset-file-input")
    .setInputFiles(promptPresetFile(filename, "preset-delayed-current", "Delayed Current"));
  await waitForDelayedPromptPresetRead(page);
  await releaseDelayedPromptPresetRead(page);

  await expect(page.locator("#preset-name")).toHaveValue("Delayed Current");
  await expect(page.getByRole("status")).toContainText(
    "Imported Delayed Current from Delayed Current.marinara.json.",
  );
  expect(pageErrors).toEqual([]);
});

test("delayed prompt preset import preserves a newer preset draft", async ({ page }) => {
  const filename = "Delayed Draft.marinara.json";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installDelayedPromptPresetRead(page, filename);

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page
    .locator(".preset-file-input")
    .setInputFiles(promptPresetFile(filename, "preset-delayed-draft", "Delayed Draft"));
  await waitForDelayedPromptPresetRead(page);

  await page.getByRole("button", { name: "＋ Preset" }).click();
  await page.locator("#preset-name").fill("Keep this draft");
  await releaseDelayedPromptPresetRead(page);

  await expect(page.getByRole("status")).toContainText(
    "Imported Delayed Draft from Delayed Draft.marinara.json.",
  );
  await expect(page.locator("#preset-name")).toHaveValue("Keep this draft");
  await expect(page.getByRole("button", { name: /Delayed Draft/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("delayed prompt preset import reports success after its Presets rail unmounts", async ({
  page,
}) => {
  const filename = "Delayed Rail.marinara.json";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installDelayedPromptPresetRead(page, filename);

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page
    .locator(".preset-file-input")
    .setInputFiles(promptPresetFile(filename, "preset-delayed-rail", "Delayed Rail"));
  await waitForDelayedPromptPresetRead(page);

  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await releaseDelayedPromptPresetRead(page);
  await page.getByRole("button", { name: "Presets", exact: true }).click();

  await expect(page.getByRole("status")).toContainText(
    "Imported Delayed Rail from Delayed Rail.marinara.json.",
  );
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delayed Rail/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("delayed prompt preset import preserves the view after its Presets rail collapses", async ({
  page,
}) => {
  const filename = "Delayed Collapse.marinara.json";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installDelayedPromptPresetRead(page, filename);

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page
    .locator(".preset-file-input")
    .setInputFiles(promptPresetFile(filename, "preset-delayed-collapse", "Delayed Collapse"));
  await waitForDelayedPromptPresetRead(page);

  await page.getByRole("button", { name: "Collapse The Shoal" }).click();
  await releaseDelayedPromptPresetRead(page);
  await page.getByRole("button", { name: "Open The Shoal" }).click();

  await expect(page.getByRole("status")).toContainText(
    "Imported Delayed Collapse from Delayed Collapse.marinara.json.",
  );
  await expect(page.getByRole("heading", { name: "DeKoi" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delayed Collapse/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
