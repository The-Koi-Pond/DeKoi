import { describe, expect, it, vi } from "vitest";

import { resolveGenerationTimeZone } from "./generation-time-zone";

vi.mock("../../../shared/browser/current-time", () => ({
  currentLocalTimeZone: () => "Australia/Sydney",
}));

describe("resolveGenerationTimeZone", () => {
  it("uses the local time zone when the caller omits a time zone", () => {
    expect(resolveGenerationTimeZone(undefined)).toBe("Australia/Sydney");
  });

  it("uses the local time zone when the caller passes no preference", () => {
    expect(resolveGenerationTimeZone(null)).toBe("Australia/Sydney");
  });

  it("preserves an explicit time zone override", () => {
    expect(resolveGenerationTimeZone("America/New_York")).toBe("America/New_York");
  });
});
