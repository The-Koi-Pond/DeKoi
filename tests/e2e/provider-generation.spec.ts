import { expect, test } from "@playwright/test";
import { DEFAULT_APP_SETTINGS } from "../../src/engine/contracts/types/app-settings";
import { createMessengerThread } from "../../src/engine/modes/messenger/messenger-actions";
import { getMessengerThreadReferenceSummary } from "../../src/features/modes/messenger/lib/thread-reference-summary";
import { getGenerationNoticeAction } from "../../src/features/modes/shared/generation-notice-actions";
import {
  describeGenerationFailureNotice,
  formatGenerationReadinessFailure,
  getGenerationConnectionReadiness,
} from "../../src/features/runtime";
import { normalizeProviderConnectionRecord } from "../../src/runtime/storage/collections/provider-connection-storage";

test("provider connection storage upgrades old runtime-kind rows and skips removed lanes", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const legacyMockConnection = {
    id: "connection-legacy-mock",
    schemaVersion: 1,
    kind: "mock",
    provider: "custom",
    label: "Local mock",
    baseUrl: "",
    model: "Mock adapter",
    summary: "",
    status: "ready",
    modelLabel: "Mock adapter",
    agentDefault: false,
    maxContext: null,
    maxOutput: null,
    createdAt,
    updatedAt: createdAt,
  };
  const oldRuntimeKindConnection = {
    ...legacyMockConnection,
    id: "connection-old-runtime-kind",
    kind: "remote-runtime",
    provider: "openai",
    label: "Remote runtime",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    modelLabel: "gpt-4o-mini",
  };
  const malformedRuntimeKindConnection = {
    ...oldRuntimeKindConnection,
    id: "connection-malformed-runtime-kind",
    provider: "not-a-provider",
  };
  const emptyFieldRuntimeKindConnection = {
    ...oldRuntimeKindConnection,
    id: "connection-empty-field-runtime-kind",
    baseUrl: "",
  };
  const providerConnection = {
    ...legacyMockConnection,
    id: "connection-provider",
    kind: "provider",
    provider: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    modelLabel: "gpt-4o-mini",
  };

  expect(normalizeProviderConnectionRecord(legacyMockConnection)).toBeNull();
  expect(
    normalizeProviderConnectionRecord({
      ...legacyMockConnection,
      id: "connection-legacy-local",
      kind: "local",
      label: "Local adapter",
    }),
  ).toBeNull();
  expect(
    normalizeProviderConnectionRecord({
      ...legacyMockConnection,
      id: "connection-missing-kind",
      kind: undefined,
      label: "Missing kind",
    }),
  ).toBeNull();
  expect(normalizeProviderConnectionRecord(malformedRuntimeKindConnection)).toBeNull();
  expect(normalizeProviderConnectionRecord(emptyFieldRuntimeKindConnection)).toBeNull();
  const upgradedConnection = normalizeProviderConnectionRecord(oldRuntimeKindConnection, {
    preserveReadyStatus: true,
  });
  expect(upgradedConnection).toEqual(
    expect.objectContaining({
      id: "connection-old-runtime-kind",
      kind: "provider",
      provider: "openai",
      label: "Remote runtime",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      status: "ready",
    }),
  );
  expect(
    normalizeProviderConnectionRecord(providerConnection, {
      preserveReadyStatus: true,
    }),
  ).toEqual(
    expect.objectContaining({
      id: "connection-provider",
      kind: "provider",
      provider: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      status: "ready",
    }),
  );

  if (!upgradedConnection) {
    throw new Error("Expected old runtime-kind provider connection to normalize.");
  }

  const thread = createMessengerThread({
    activePersonaId: null,
    characterIds: [],
    id: "thread-existing-connection",
    branchId: "thread-existing-connection-branch",
    now: createdAt,
    providerConnectionId: upgradedConnection.id,
    title: "Existing connection thread",
  });
  const summary = getMessengerThreadReferenceSummary({
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    lorebooks: [],
    personas: [],
    promptPresets: [],
    providerConnections: [upgradedConnection],
    thread,
  });
  expect(summary).toEqual(
    expect.objectContaining({
      hasMissingConnection: false,
      hasNoConnectionAvailable: false,
    }),
  );
});

test("provider generation readiness blocks desktop-key providers in browser mode", () => {
  const createdAt = "2026-06-28T00:00:00.000Z";
  const keyedConnections = [
    {
      id: "connection-openai",
      provider: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    },
    {
      id: "connection-anthropic",
      provider: "anthropic",
      label: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-5",
    },
  ].map((connection) =>
    normalizeProviderConnectionRecord(
      {
        ...connection,
        schemaVersion: 1,
        kind: "provider",
        summary: "",
        status: "ready",
        modelLabel: connection.model,
        agentDefault: false,
        maxContext: null,
        maxOutput: null,
        createdAt,
        updatedAt: createdAt,
      },
      { preserveReadyStatus: true },
    ),
  );
  const customConnection = normalizeProviderConnectionRecord(
    {
      id: "connection-custom",
      schemaVersion: 1,
      kind: "provider",
      provider: "custom",
      label: "Local custom",
      baseUrl: "http://localhost:11434/v1",
      model: "local-model",
      summary: "",
      status: "ready",
      modelLabel: "local-model",
      agentDefault: false,
      maxContext: null,
      maxOutput: null,
      createdAt,
      updatedAt: createdAt,
    },
    { preserveReadyStatus: true },
  );

  expect(keyedConnections).not.toContain(null);
  expect(customConnection).not.toBeNull();
  if (keyedConnections.some((connection) => connection === null) || !customConnection) {
    throw new Error("Expected test provider connections to normalize.");
  }

  for (const connection of keyedConnections) {
    const blocked = getGenerationConnectionReadiness(connection);
    expect(blocked).toEqual({
      ready: false,
      code: "desktop-key-store-unavailable",
    });
    if (!blocked.ready) {
      expect(formatGenerationReadinessFailure(blocked.code)).toContain("desktop app");
    }
  }

  const ready = getGenerationConnectionReadiness(customConnection);
  expect(ready.ready).toBe(true);
  if (ready.ready) {
    expect(ready.connection.id).toBe("connection-custom");
  }
});

test("provider generation failure notices point to useful recovery", () => {
  expect(getGenerationNoticeAction("new-connection", null)).toEqual({
    kind: "create-connection",
    label: "Create connection",
  });
  expect(getGenerationNoticeAction("connections", "connection-openai")).toEqual({
    kind: "open-connection",
    label: "Open connection",
    connectionId: "connection-openai",
  });
  expect(getGenerationNoticeAction("connections", null)).toEqual({
    kind: "open-connection",
    label: "Open Connections",
    connectionId: null,
  });

  const missingConnection = describeGenerationFailureNotice(
    new Error(
      "Provider Messenger generation failed. Generation needs a configured provider connection.",
    ),
    "Messenger generation failed.",
  );

  expect(missingConnection.message).toContain("provider connection");
  expect(missingConnection.recoveryTarget).toBe("new-connection");

  const rejectedKey = describeGenerationFailureNotice(
    new Error(
      "Provider Messenger generation failed. Provider returned HTTP 401 Unauthorized: invalid_api_key",
    ),
    "Messenger generation failed.",
  );

  expect(rejectedKey.message).toContain("API key");
  expect(rejectedKey.message).toContain("invalid_api_key");
  expect(rejectedKey.recoveryTarget).toBe("connections");

  const unavailableModel = describeGenerationFailureNotice(
    new Error(
      "Provider returned HTTP 400 Bad Request: The selected model is not available for this key.",
    ),
    "Messenger generation failed.",
  );

  expect(unavailableModel.message).toContain("model");
  expect(unavailableModel.message).toContain("not available");
  expect(unavailableModel.recoveryTarget).toBe("connections");

  const rateLimit = describeGenerationFailureNotice(
    "Provider returned HTTP 429 Too Many Requests: rate limit exceeded",
    "Messenger generation failed.",
  );

  expect(rateLimit.message).toContain("rate limit");
  expect(rateLimit.recoveryTarget).toBeUndefined();

  const corsBlocked = describeGenerationFailureNotice(
    "TypeError: CORS request blocked",
    "Messenger generation failed.",
  );

  expect(corsBlocked.message).toContain("Browser provider request was blocked");
  expect(corsBlocked.recoveryTarget).toBe("connections");

  const noText = describeGenerationFailureNotice(
    "Provider returned no text (finish reason: length).",
    "Provider generation did not return a Messenger reply.",
  );

  expect(noText.message).toContain("did not return text");
  expect(noText.recoveryTarget).toBeUndefined();
});
