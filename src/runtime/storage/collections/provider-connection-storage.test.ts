import { describe, expect, it } from "vitest";

import { normalizeProviderConnectionRecord } from "./provider-connection-storage";

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeProviderConnectionRecord", () => {
  it("rejects old runtime-kind provider rows on the native load path", () => {
    expect(
      normalizeProviderConnectionRecord({
        id: "connection-1",
        schemaVersion: 1,
        kind: "remote-runtime",
        provider: "openai",
        label: "Remote runtime",
        baseUrl: "",
        model: "Mock adapter",
        summary: "Legacy configured runtime.",
        status: "ready",
        modelLabel: "Mock adapter",
        agentDefault: false,
        maxContext: null,
        maxOutput: null,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it("does not read legacy provider aliases on the native load path", () => {
    const record = normalizeProviderConnectionRecord({
      id: "connection-1",
      schemaVersion: 1,
      kind: "provider",
      provider: "openai",
      name: "Legacy OpenAI",
      label: "Remote runtime",
      url: "https://legacy.example/v1",
      baseUrl: "",
      model: "Mock adapter",
      summary: "Legacy configured runtime.",
      status: "ready",
      modelLabel: "Mock adapter",
      agentDefault: false,
      maxContext: null,
      maxOutput: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toEqual(
      expect.objectContaining({
        label: "Remote runtime",
        baseUrl: "https://api.openai.com/v1",
        model: "Mock adapter",
        summary: "Legacy configured runtime.",
        status: "needs-key",
      }),
    );
  });
});
