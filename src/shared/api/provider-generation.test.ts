import { describe, expect, it, vi } from "vitest";

import { invokeDesktopRuntime } from "./desktop-runtime";
import {
  invokeProviderGeneration,
  type ProviderGenerationCommandRequest,
} from "./provider-generation";
import { RUNTIME_COMMANDS } from "./runtime-commands";

vi.mock("./desktop-runtime", () => ({ invokeDesktopRuntime: vi.fn() }));

describe("provider generation desktop API", () => {
  it("invokes generation_generate with only its narrow request DTO", async () => {
    const request: ProviderGenerationCommandRequest = {
      id: "request-1",
      createdAt: "2026-07-15T00:00:00.000Z",
      targetCharacterId: "character-1",
      targetCharacterName: "Koi",
      connection: {
        id: "connection-1",
        provider: "openai",
        baseUrl: "https://provider.test/v1",
        model: "test-model",
        status: "ready",
      },
      promptMessages: [{ role: "user", content: "Hello" }],
      parameters: { maxTokens: 100 },
    };
    vi.mocked(invokeDesktopRuntime).mockResolvedValueOnce({ ok: true });

    const response: unknown = await invokeProviderGeneration(request);

    expect(invokeDesktopRuntime).toHaveBeenCalledWith(RUNTIME_COMMANDS.generationGenerate, {
      request,
    });
    expect(response).toEqual({ ok: true });
  });
});
