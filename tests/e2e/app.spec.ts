import { expect, test } from "@playwright/test";

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
