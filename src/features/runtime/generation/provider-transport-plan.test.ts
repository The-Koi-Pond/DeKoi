import { describe, expect, it } from "vitest";

import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import { resolveProviderTransportPlan } from "./provider-transport-plan";

describe("provider transport plans", () => {
  it.each([
    ["openai", "openai", "openai", "openai"],
    ["mistral", "conservative-oai", "openai", "openai"],
    ["cohere", "conservative-oai", "openai", "openai"],
    ["nanogpt", "conservative-oai", "openai", "openai"],
    ["xai", "conservative-oai", "openai", "openai"],
    ["openrouter", "openrouter", "openai", "openai"],
    ["custom", "custom", "openai", "openai"],
    ["anthropic", "anthropic", "anthropic", "anthropic"],
    ["google", "google", "google", "google"],
  ] as const)(
    "maps %s to payload/endpoint/response kinds",
    (provider, payloadKind, endpointKind, responseKind) => {
      expect(resolveProviderTransportPlan(provider)).toEqual({
        provider,
        payloadKind,
        endpointKind,
        responseKind,
      });
    },
  );

  it.each(["openai_chatgpt", "claude_subscription", "google_vertex"] as const)(
    "leaves %s unsupported",
    (provider: ProviderConnectionProvider) => {
      expect(resolveProviderTransportPlan(provider)).toBeUndefined();
    },
  );
});
