import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRemoteRuntimeHealth } from "./remote-runtime-health";
import { fetchRemoteRuntimeJson } from "./remote-runtime-http";

vi.mock("./desktop-runtime", () => ({
  checkDesktopRuntimeHealth: vi.fn(),
}));

vi.mock("./remote-runtime-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./remote-runtime-http")>();
  return {
    ...actual,
    fetchRemoteRuntimeJson: vi.fn(),
  };
});

const fetchRemoteRuntimeJsonMock = vi.mocked(fetchRemoteRuntimeJson);

describe("checkRemoteRuntimeHealth", () => {
  beforeEach(() => {
    fetchRemoteRuntimeJsonMock.mockReset();
  });

  it("includes fetch failure details in unreachable remote runtime health results", async () => {
    fetchRemoteRuntimeJsonMock.mockRejectedValueOnce(
      new Error("Remote runtime request timed out after 5 seconds."),
    );

    const result = await checkRemoteRuntimeHealth("https://runtime.test");

    expect(result).toEqual({
      status: "unreachable",
      message: "Remote runtime is unreachable. Remote runtime request timed out after 5 seconds.",
    });
  });

  it("redacts authorization details from unreachable remote runtime health results", async () => {
    fetchRemoteRuntimeJsonMock.mockRejectedValueOnce(
      new Error("Authorization: Bearer secret-token failed."),
    );

    const result = await checkRemoteRuntimeHealth("https://runtime.test");

    expect(result.message).toBe(
      "Remote runtime is unreachable. Authorization: Bearer [redacted] failed.",
    );
    expect(result.message).not.toContain("secret-token");
  });
});
