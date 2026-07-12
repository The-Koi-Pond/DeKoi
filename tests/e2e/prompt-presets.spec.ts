import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
        systemPrompt: "Write the next response.",
        parameters: { temperature: 0.65 },
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
      sections: [],
      groups: [],
      choiceBlocks: [],
    },
  };
}

function promptPresetFile(name: string, id: string, title: string) {
  return {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(promptPresetPackage(id, title))),
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

test("prompt preset choice definitions can be authored and saved", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("button", { name: "＋ Preset" }).click();

  await page.getByLabel("Title").fill("Choice Editor Proof");
  await page.getByLabel("System Prompt").fill("Stay in character.");

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
    promptPresetFile("Portable Proof.marinara.json", "preset-portable-source", "Portable Proof"),
  );

  await expect(page.getByLabel("Title")).toHaveValue("Portable Proof");
  await expect(page.getByRole("status")).toHaveText(
    "Imported Portable Proof from Portable Proof.marinara.json. Storage is unavailable; this imported preset exists only for this session.",
  );
  await expect(page.getByRole("button", { name: "Import JSON" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

  await page.getByLabel("Title").fill("Portable Proof draft");
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeDisabled();
  await expect(page.getByText("Save changes before exporting this preset.")).toBeVisible();
  await page.getByLabel("Title").fill("Portable Proof");
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
    version: 1,
    data: { preset: { name: "Portable Proof" } },
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

  await expect(page.getByLabel("Title")).toHaveValue("Delayed Current");
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
  await page.getByLabel("Title").fill("Keep this draft");
  await releaseDelayedPromptPresetRead(page);

  await expect(page.getByRole("status")).toContainText(
    "Imported Delayed Draft from Delayed Draft.marinara.json.",
  );
  await expect(page.getByLabel("Title")).toHaveValue("Keep this draft");
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
