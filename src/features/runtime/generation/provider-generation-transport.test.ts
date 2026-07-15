import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import type { GenerationParameters } from "../../../engine/generation/generation";
import { invokeProviderGeneration } from "../../../shared/api/provider-generation";
import {
  generateWithConfiguredProvider,
  providerErrorMessage,
  type ProviderGenerationRequest,
} from "./provider-generation";

const host = vi.hoisted(() => ({ desktop: false }));

vi.mock("../../../shared/api/desktop-host-common", () => ({
  isDesktopHostAvailable: () => host.desktop,
}));
vi.mock("../../../shared/api/provider-generation", () => ({ invokeProviderGeneration: vi.fn() }));

function request(
  provider: ProviderConnectionProvider = "custom",
  parameters: GenerationParameters = {
    temperature: 0.8,
    maxTokens: 1_024,
    topP: 0.95,
  },
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
    vi.mocked(invokeProviderGeneration).mockReset();
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
    [
      "custom parameters on non-custom provider",
      "openai",
      { customParameters: { feature_enabled: true } },
      "only by the custom provider",
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

  it.each([
    ["anthropic missing max", "anthropic", { temperature: 0.5 }, "requires maxTokens"],
    [
      "protected custom collision",
      "custom",
      { customParameters: { maxOutputTokens: 10 } },
      "reserved",
    ],
    [
      "custom parameters on non-custom provider",
      "openai",
      { customParameters: { feature_enabled: true } },
      "only by the custom provider",
    ],
    ["unsupported provider", "openai_chatgpt", {}, "not supported for generation"],
  ] as const)("stops %s before desktop invoke", async (_name, provider, parameters, error) => {
    host.desktop = true;

    await expect(
      generateWithConfiguredProvider(
        request(provider as ProviderConnectionProvider, parameters as GenerationParameters),
      ),
    ).rejects.toThrow(error);
    expect(invokeProviderGeneration).not.toHaveBeenCalled();
  });

  it("narrows desktop generation without using browser HTTP", async () => {
    host.desktop = true;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(invokeProviderGeneration).mockResolvedValueOnce({
      schemaVersion: 1,
      requestId: "request-1",
      source: "provider-transport",
      createdAt: "2026-07-15T00:00:01.000Z",
      messages: [{ characterId: "character-1", body: "Hi" }],
      warnings: [],
    });

    await generateWithConfiguredProvider(
      request("custom", { maxTokens: 100 } as GenerationParameters),
    );

    expect(invokeProviderGeneration).toHaveBeenCalledWith({
      id: "request-1",
      createdAt: "2026-07-15T00:00:00.000Z",
      targetCharacterId: "character-1",
      targetCharacterName: "Koi",
      connection: {
        id: "connection-1",
        provider: "custom",
        baseUrl: "https://provider.test/v1",
        model: "test-model",
        status: "ready",
      },
      promptMessages: [{ role: "user", content: "Hello" }],
      parameters: { maxTokens: 100 },
    });
    expect(JSON.stringify(vi.mocked(invokeProviderGeneration).mock.calls)).not.toMatch(
      /thread|companions|activePersona|lorebooks|warnings|summary/,
    );
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

  it.each([
    ["access_token=access-secret", "access-secret"],
    ["token: token-secret", "token-secret"],
    ['"api_key":"json-secret"', "json-secret"],
    ["'accessToken': 'quoted secret'", "quoted secret"],
  ])("redacts protected credential field in %s", (detail, secret) => {
    const message = providerErrorMessage(new Error(detail));

    expect(message).not.toContain(secret);
    expect(message).toContain("[redacted]");
  });
});
