import { describe, expect, it } from "vitest";

import { normalizeProviderConnectionRecord } from "./provider-connection-storage";

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeProviderConnectionRecord", () => {
  it("migrates old remote-runtime provider rows to the native provider kind", () => {
    const record = normalizeProviderConnectionRecord(
      {
        id: "connection-1",
        schemaVersion: 1,
        kind: "remote-runtime",
        provider: "custom",
        label: "Local provider",
        baseUrl: "http://localhost:11434/v1",
        model: "local-model",
        summary: "Existing saved connection.",
        status: "ready",
        modelLabel: "local-model",
        agentDefault: false,
        maxContext: null,
        maxOutput: null,
        createdAt: now,
        updatedAt: now,
      },
      { preserveReadyStatus: true },
    );

    expect(record).toEqual(
      expect.objectContaining({
        id: "connection-1",
        kind: "provider",
        provider: "custom",
        label: "Local provider",
        baseUrl: "http://localhost:11434/v1",
        model: "local-model",
        status: "ready",
      }),
    );
  });

  it("rejects removed or missing provider lanes on the native load path", () => {
    const baseConnection = {
      id: "connection-removed",
      schemaVersion: 1,
      provider: "custom",
      label: "Removed lane",
      baseUrl: "",
      model: "",
      summary: "",
      status: "ready",
      modelLabel: null,
      agentDefault: false,
      maxContext: null,
      maxOutput: null,
      createdAt: now,
      updatedAt: now,
    };

    expect(normalizeProviderConnectionRecord({ ...baseConnection, kind: "mock" })).toBeNull();
    expect(normalizeProviderConnectionRecord({ ...baseConnection, kind: "local" })).toBeNull();
    expect(
      normalizeProviderConnectionRecord({
        ...baseConnection,
        kind: undefined,
        id: "connection-missing-kind",
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
