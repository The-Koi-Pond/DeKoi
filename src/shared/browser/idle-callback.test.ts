import { afterEach, describe, expect, it, vi } from "vitest";

import { requestIdle } from "./idle-callback";

describe("requestIdle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a deadline to the browser idle callback", () => {
    const requestIdleCallback = vi.fn(() => 7);
    vi.stubGlobal("window", { requestIdleCallback });
    const callback = vi.fn();

    expect(requestIdle(callback, { timeout: 1_000 })).toBe(7);
    expect(requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 1_000 });
  });
});
