import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";

type ProviderPayloadKind =
  "openai" | "conservative-oai" | "openrouter" | "anthropic" | "google" | "custom";
type ProviderEndpointKind = "openai" | "anthropic" | "google";
type ProviderResponseKind = "openai" | "anthropic" | "google";

export interface ProviderTransportPlan {
  readonly provider: ProviderConnectionProvider;
  readonly payloadKind: ProviderPayloadKind;
  readonly endpointKind: ProviderEndpointKind;
  readonly responseKind: ProviderResponseKind;
}

const PROVIDER_TRANSPORT_PLANS = {
  openai: {
    provider: "openai",
    payloadKind: "openai",
    endpointKind: "openai",
    responseKind: "openai",
  },
  mistral: {
    provider: "mistral",
    payloadKind: "conservative-oai",
    endpointKind: "openai",
    responseKind: "openai",
  },
  cohere: {
    provider: "cohere",
    payloadKind: "conservative-oai",
    endpointKind: "openai",
    responseKind: "openai",
  },
  nanogpt: {
    provider: "nanogpt",
    payloadKind: "conservative-oai",
    endpointKind: "openai",
    responseKind: "openai",
  },
  xai: {
    provider: "xai",
    payloadKind: "conservative-oai",
    endpointKind: "openai",
    responseKind: "openai",
  },
  openrouter: {
    provider: "openrouter",
    payloadKind: "openrouter",
    endpointKind: "openai",
    responseKind: "openai",
  },
  custom: {
    provider: "custom",
    payloadKind: "custom",
    endpointKind: "openai",
    responseKind: "openai",
  },
  anthropic: {
    provider: "anthropic",
    payloadKind: "anthropic",
    endpointKind: "anthropic",
    responseKind: "anthropic",
  },
  google: {
    provider: "google",
    payloadKind: "google",
    endpointKind: "google",
    responseKind: "google",
  },
  openai_chatgpt: undefined,
  claude_subscription: undefined,
  google_vertex: undefined,
} as const satisfies Readonly<
  Record<ProviderConnectionProvider, ProviderTransportPlan | undefined>
>;

export function resolveProviderTransportPlan(
  provider: ProviderConnectionProvider,
): ProviderTransportPlan | undefined {
  return PROVIDER_TRANSPORT_PLANS[provider];
}
