import { describe, expect, it } from "vitest";

import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./app-settings";

describe("normalizeAppSettings", () => {
  it("normalizes global lorebook IDs and insertion strategy", () => {
    const settings = normalizeAppSettings({
      ...DEFAULT_APP_SETTINGS,
      globalLorebookIds: [" lore-1 ", "", "lore-2", "lore-1"],
      loreInsertionStrategy: "character-first",
    });

    expect(settings.globalLorebookIds).toEqual(["lore-1", "lore-2"]);
    expect(settings.loreInsertionStrategy).toBe("character-first");
  });

  it("defaults invalid global lore settings", () => {
    const settings = normalizeAppSettings({
      globalLorebookIds: "lore-1",
      loreInsertionStrategy: "unknown",
    });

    expect(settings.globalLorebookIds).toEqual([]);
    expect(settings.loreInsertionStrategy).toBe(DEFAULT_APP_SETTINGS.loreInsertionStrategy);
  });

  it("normalizes the prompt preset starter initialization marker", () => {
    expect(
      normalizeAppSettings({ promptPresetStarterInitialized: true }).promptPresetStarterInitialized,
    ).toBe(true);
    expect(
      normalizeAppSettings({ promptPresetStarterInitialized: "true" })
        .promptPresetStarterInitialized,
    ).toBe(false);
  });
});
