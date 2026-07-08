import { describe, expect, it } from "vitest";

import { sanitizeRemoteRuntimeErrorDetail } from "./remote-runtime-http";

describe("sanitizeRemoteRuntimeErrorDetail", () => {
  it("redacts bearer authorization header details", () => {
    expect(sanitizeRemoteRuntimeErrorDetail("Authorization: Bearer secret-token failed.")).toBe(
      "Authorization: Bearer [redacted] failed.",
    );
  });

  it("redacts basic authorization header details", () => {
    expect(sanitizeRemoteRuntimeErrorDetail("authorization: Basic dXNlcjpzZWNyZXQ= failed.")).toBe(
      "authorization: Basic [redacted] failed.",
    );
  });

  it("redacts URL userinfo details", () => {
    expect(
      sanitizeRemoteRuntimeErrorDetail(
        "Fetch failed for https://user:secret@runtime.test/health?probe=1.",
      ),
    ).toBe("Fetch failed for https://[redacted]@runtime.test/health?probe=1.");
  });
});
