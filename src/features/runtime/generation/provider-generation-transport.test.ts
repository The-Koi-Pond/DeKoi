import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import type { GenerationParameters } from "../../../engine/generation/generation";
import {
  generateWithConfiguredProvider,
  providerErrorMessage,
  type ProviderGenerationRequest,
} from "./provider-generation";

const host = vi.hoisted(() => ({ desktop: false }));

vi.mock("../../../shared/api/desktop-host-common", () => ({
  isDesktopHostAvailable: () => host.desktop,
}));

function request(
  provider: ProviderConnectionProvider = "custom",
  parameters: GenerationParameters = { maxTokens: 1_024, temperature: 0.8, topP: 0.95 },
): ProviderGenerationRequest {
  return {
    schemaVersion: 1,
    id: "request-1",
    createdAt: "2026-07-15T00:00:00.000Z",
    providerConnectionId: "connection-1",
    providerConnection: {
      id: "connection-1",
      schemaVersion: 1,
      kind: "provider",
      provider,
      label: "Test",
      baseUrl: "https://provider.test/v1",
      model: "test-model",
      summary: "private connection summary",
      status: "ready",
      modelLabel: null,
      agentDefault: false,
      maxContext: null,
      maxOutput: null,
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    },
    targetCharacterId: "character-1",
    targetCharacterName: "Koi",
    promptMessages: [{ role: "user", content: "Hello" }],
    parameters,
    warnings: ["private warning"],
    thread: { private: true },
    companions: [{ private: true }],
    activePersona: { private: true },
    lorebooks: [{ private: true }],
  } as unknown as ProviderGenerationRequest;
}

describe("configured provider transport", () => {
  beforeEach(() => {
    host.desktop = false;
    vi.unstubAllGlobals();
  });

  it("sends exactly one browser request when the provider rejects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Rejected", code: "bad_request" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateWithConfiguredProvider(request())).rejects.toThrow("Rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["anthropic missing max", "anthropic", { temperature: 0.5 }, "requires maxTokens"],
    [
      "protected custom collision",
      "custom",
      { customParameters: { maxOutputTokens: 10 } },
      "reserved",
    ],
    ["unsupported provider", "openai_chatgpt", {}, "not supported for generation"],
  ] as const)("stops %s before HTTP", async (_name, provider, parameters, error) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateWithConfiguredProvider(
        request(provider as ProviderConnectionProvider, parameters as GenerationParameters),
      ),
    ).rejects.toThrow(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redacts secrets and URL userinfo and caps surfaced provider errors", () => {
    const message = providerErrorMessage(
      new Error(
        `Authorization: Bearer secret-token https://user:password@provider.test api_key=sk-secret AIzaSyExampleGoogleKey123456789 ${"x".repeat(500)}`,
      ),
    );

    expect(message).not.toMatch(/secret-token|password|sk-secret|AIzaSyExampleGoogleKey/);
    expect(message.length).toBeLessThanOrEqual(300);
  });
});
