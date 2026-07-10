import { expect, test } from "@playwright/test";

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
