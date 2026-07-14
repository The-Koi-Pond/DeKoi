import { expect, test } from "@playwright/test";
import { join } from "node:path";

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
  await dialog.getByRole("button", { name: "Use Defaults" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: /^Prompt Preset/ }).click();
  await page.getByRole("button", { name: "Variables", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".preset-variables-field")).toHaveCount(starterQuestions.length);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
