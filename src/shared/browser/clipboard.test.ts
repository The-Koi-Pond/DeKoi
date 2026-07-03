import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
  });

  function setClipboard(value: Partial<Navigator["clipboard"]> | undefined) {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value,
    });
  }

  it("resolves true and writes when the clipboard API is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false when the clipboard API is unavailable", async () => {
    setClipboard(undefined);
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });

  it("resolves false (without throwing) when writeText rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });
});
