import type { ProviderConnectionProvider } from "../../../engine/contracts/types/provider-connection";
import type {
  GenerationParameters,
  GenerationPromptMessage,
} from "../../../engine/generation/generation";
import {
  validateGenerationCustomParameter,
  validateGenerationCustomParameters,
} from "../../../engine/generation-core/generation-custom-parameter-policy";
import {
  resolveProviderTransportPlan,
  type ProviderTransportPlan,
} from "./provider-transport-plan";

type ProviderJson = Record<string, unknown>;
type ParameterKey = Exclude<keyof GenerationParameters, "customParameters">;
type ParameterMapping = readonly [ParameterKey, string];

export interface ProviderPayloadInput {
  provider: ProviderConnectionProvider;
  model: string;
  messages: GenerationPromptMessage[];
  parameters: GenerationParameters;
}

// Provider wire boundaries verified 2026-07-15 against:
// https://developers.openai.com/api/reference/resources/chat
// https://platform.claude.com/docs/en/api/messages
// https://ai.google.dev/api/generate-content
// https://openrouter.ai/docs/api/reference/parameters
const COMMON_OAI_MAPPINGS = [
  ["temperature", "temperature"],
  ["topP", "top_p"],
  ["frequencyPenalty", "frequency_penalty"],
  ["presencePenalty", "presence_penalty"],
  ["stopSequences", "stop"],
] as const satisfies readonly ParameterMapping[];

function assignMapped(
  payload: ProviderJson,
  parameters: GenerationParameters,
  mappings: readonly ParameterMapping[],
) {
  for (const [parameterName, wireName] of mappings) {
    const value = parameters[parameterName];
    if (value !== undefined) payload[wireName] = value;
  }
}

function systemPrompt(messages: GenerationPromptMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter((content) => content.trim().length > 0)
    .join("\n\n");
}

function nonSystemMessages(messages: GenerationPromptMessage[]) {
  return messages.filter((message) => message.role !== "system");
}

function buildOpenAiPayload(input: ProviderPayloadInput) {
  const payload: ProviderJson = { model: input.model, messages: input.messages };
  assignMapped(payload, input.parameters, [
    ["maxTokens", "max_completion_tokens"],
    ...COMMON_OAI_MAPPINGS,
  ]);
  assignMapped(payload, input.parameters, [["reasoningEffort", "reasoning_effort"]]);
  const tier = input.parameters.serviceTier;
  if (
    tier === "auto" ||
    tier === "default" ||
    tier === "flex" ||
    tier === "scale" ||
    tier === "priority"
  ) {
    payload.service_tier = tier;
  }
  return payload;
}

function buildConservativeOaiPayload(input: ProviderPayloadInput) {
  const payload: ProviderJson = { model: input.model, messages: input.messages };
  assignMapped(payload, input.parameters, [["maxTokens", "max_tokens"], ...COMMON_OAI_MAPPINGS]);
  return payload;
}

function buildOpenRouterPayload(input: ProviderPayloadInput) {
  const payload = buildConservativeOaiPayload(input);
  assignMapped(payload, input.parameters, [
    ["topK", "top_k"],
    ["minP", "min_p"],
    ["reasoningEffort", "reasoning_effort"],
    ["verbosity", "verbosity"],
  ]);
  return payload;
}

function buildAnthropicPayload(input: ProviderPayloadInput) {
  if (input.parameters.maxTokens === undefined) {
    throw new Error("Anthropic generation requires maxTokens.");
  }

  const payload: ProviderJson = {
    model: input.model,
    messages: nonSystemMessages(input.messages),
  };
  const system = systemPrompt(input.messages);
  if (system) payload.system = system;
  assignMapped(payload, input.parameters, [
    ["maxTokens", "max_tokens"],
    ["temperature", "temperature"],
    ["topP", "top_p"],
    ["topK", "top_k"],
    ["stopSequences", "stop_sequences"],
  ]);

  const effort = input.parameters.reasoningEffort;
  if (
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "xhigh" ||
    effort === "max"
  ) {
    payload.output_config = { effort };
  }
  const tier = input.parameters.serviceTier;
  if (tier === "auto" || tier === "standard_only") payload.service_tier = tier;
  return payload;
}

function googleThinkingLevel(effort: GenerationParameters["reasoningEffort"]) {
  if (effort === "minimal") return "MINIMAL";
  if (effort === "low") return "LOW";
  if (effort === "medium") return "MEDIUM";
  if (effort === "high" || effort === "xhigh" || effort === "max") return "HIGH";
  return undefined;
}

function buildGooglePayload(input: ProviderPayloadInput) {
  const payload: ProviderJson = {
    contents: nonSystemMessages(input.messages).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
  };
  const system = systemPrompt(input.messages);
  if (system) payload.systemInstruction = { parts: [{ text: system }] };

  const generationConfig: ProviderJson = {};
  assignMapped(generationConfig, input.parameters, [
    ["maxTokens", "maxOutputTokens"],
    ["temperature", "temperature"],
    ["topP", "topP"],
    ["topK", "topK"],
    ["frequencyPenalty", "frequencyPenalty"],
    ["presencePenalty", "presencePenalty"],
  ]);
  if (input.parameters.stopSequences !== undefined) {
    generationConfig.stopSequences = input.parameters.stopSequences.slice(0, 5);
  }
  const thinkingLevel = googleThinkingLevel(input.parameters.reasoningEffort);
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };
  if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;
  return payload;
}

function mergeCustomParameters(payload: ProviderJson, parameters: GenerationParameters) {
  const customParameters = parameters.customParameters ?? {};
  for (const [name, value] of Object.entries(customParameters)) {
    const validation = validateGenerationCustomParameter(name, value);
    if (
      (!validation.valid && validation.reason === "protected-name") ||
      Object.prototype.hasOwnProperty.call(payload, name)
    ) {
      throw new Error(`Custom parameter name is reserved: ${name}.`);
    }
    if (!validation.valid) throw new Error("Custom parameters exceed safety limits.");
  }
  if (!validateGenerationCustomParameters(customParameters)) {
    throw new Error("Custom parameters exceed safety limits.");
  }
  for (const [name, value] of Object.entries(customParameters)) {
    payload[name] = value;
  }
}

function buildCustomPayload(input: ProviderPayloadInput) {
  const payload = buildConservativeOaiPayload(input);
  assignMapped(payload, input.parameters, [
    ["topK", "top_k"],
    ["minP", "min_p"],
    ["reasoningEffort", "reasoning_effort"],
    ["verbosity", "verbosity"],
    ["serviceTier", "service_tier"],
  ]);
  mergeCustomParameters(payload, input.parameters);
  return payload;
}

export function buildProviderPayload(input: ProviderPayloadInput): ProviderJson {
  const plan = resolveProviderTransportPlan(input.provider);
  if (plan) return buildProviderPayloadForPlan(input, plan);
  throw new Error(`${input.provider} is not supported for generation.`);
}

export function buildProviderPayloadForPlan(
  input: ProviderPayloadInput,
  plan: ProviderTransportPlan,
): ProviderJson {
  if (
    plan.payloadKind !== "custom" &&
    Object.keys(input.parameters.customParameters ?? {}).length > 0
  ) {
    throw new Error("Custom parameters are supported only by the custom provider.");
  }
  if (
    (plan.payloadKind === "anthropic" || plan.payloadKind === "google") &&
    nonSystemMessages(input.messages).length === 0
  ) {
    throw new Error("Provider generation requires at least one user or assistant prompt message.");
  }

  if (plan.payloadKind === "openai") return buildOpenAiPayload(input);
  if (plan.payloadKind === "conservative-oai") return buildConservativeOaiPayload(input);
  if (plan.payloadKind === "openrouter") return buildOpenRouterPayload(input);
  if (plan.payloadKind === "anthropic") return buildAnthropicPayload(input);
  if (plan.payloadKind === "google") return buildGooglePayload(input);
  return buildCustomPayload(input);
}
