import { invokeDesktopRuntime } from "./desktop-runtime";
import { RUNTIME_COMMANDS } from "./runtime-commands";

interface ProviderGenerationPromptMessageDto {
  role: "system" | "user" | "assistant";
  content: string;
}

type ProviderGenerationProvider =
  | "openai"
  | "openai_chatgpt"
  | "anthropic"
  | "claude_subscription"
  | "google"
  | "google_vertex"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "nanogpt"
  | "xai"
  | "custom";

type ProviderGenerationJsonValue =
  | null
  | boolean
  | number
  | string
  | ProviderGenerationJsonValue[]
  | { [key: string]: ProviderGenerationJsonValue };

interface ProviderGenerationParametersDto {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  verbosity?: "low" | "medium" | "high" | "xhigh" | "max";
  serviceTier?: "auto" | "default" | "flex" | "scale" | "priority" | "standard_only";
  stopSequences?: string[];
  customParameters?: Record<string, ProviderGenerationJsonValue>;
}

export interface ProviderGenerationCommandRequest {
  id: string;
  createdAt: string;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  connection: {
    id: string;
    provider: ProviderGenerationProvider;
    baseUrl: string;
    model: string;
    status: "ready" | "needs-key";
  };
  promptMessages: ProviderGenerationPromptMessageDto[];
  parameters: ProviderGenerationParametersDto;
}

export async function invokeProviderGeneration(
  request: ProviderGenerationCommandRequest,
): Promise<unknown> {
  return await invokeDesktopRuntime<unknown>(RUNTIME_COMMANDS.generationGenerate, { request });
}
