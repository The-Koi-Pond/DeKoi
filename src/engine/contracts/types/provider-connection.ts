export type ProviderConnectionId = string;

export type ProviderConnectionKind = "remote-runtime";
export type ProviderConnectionProvider =
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
export type ProviderConnectionStatus = "ready" | "needs-key";

export interface ProviderConnectionProviderOption {
  value: ProviderConnectionProvider;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
  apiKeyRequired: boolean;
}

const PROVIDER_CONNECTION_PROVIDER_VALUES: ProviderConnectionProvider[] = [
  "openai",
  "openai_chatgpt",
  "anthropic",
  "claude_subscription",
  "google",
  "google_vertex",
  "mistral",
  "cohere",
  "openrouter",
  "nanogpt",
  "xai",
  "custom",
];

export interface ProviderConnectionRecord {
  id: ProviderConnectionId;
  schemaVersion: 1;
  kind: ProviderConnectionKind;
  provider: ProviderConnectionProvider;
  label: string;
  baseUrl: string;
  model: string;
  summary: string;
  status: ProviderConnectionStatus;
  modelLabel: string | null;
  keeperDefault: boolean;
  maxContext: number | null;
  maxOutput: number | null;
  createdAt: string;
  updatedAt: string;
}

export const PROVIDER_CONNECTION_DURABLE_FIELD_SET = {
  id: true,
  schemaVersion: true,
  kind: true,
  provider: true,
  label: true,
  baseUrl: true,
  model: true,
  summary: true,
  status: true,
  modelLabel: true,
  keeperDefault: true,
  maxContext: true,
  maxOutput: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Record<keyof ProviderConnectionRecord, true>;

export const PROVIDER_CONNECTION_DURABLE_FIELDS = Object.keys(
  PROVIDER_CONNECTION_DURABLE_FIELD_SET,
).sort() as (keyof ProviderConnectionRecord)[];

const defaultTimestamp = "2026-06-23T09:30:00.000Z";

export const PROVIDER_CONNECTION_PROVIDER_OPTIONS: ProviderConnectionProviderOption[] = [
  {
    value: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini"],
    apiKeyRequired: true,
  },
  {
    value: "openai_chatgpt",
    label: "OpenAI (ChatGPT Subscription)",
    defaultBaseUrl: "",
    defaultModel: "gpt-5.4-mini",
    models: ["gpt-5.4-mini", "gpt-5", "chatgpt-4o-latest"],
    apiKeyRequired: false,
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-3-5-sonnet-latest"],
    apiKeyRequired: true,
  },
  {
    value: "claude_subscription",
    label: "Claude (Subscription)",
    defaultBaseUrl: "",
    defaultModel: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"],
    apiKeyRequired: false,
  },
  {
    value: "google",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
    apiKeyRequired: true,
  },
  {
    value: "google_vertex",
    label: "Google Vertex AI",
    defaultBaseUrl:
      "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
    apiKeyRequired: false,
  },
  {
    value: "mistral",
    label: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
    apiKeyRequired: true,
  },
  {
    value: "cohere",
    label: "Cohere",
    defaultBaseUrl: "https://api.cohere.ai/compatibility/v1",
    defaultModel: "command-r-plus",
    models: ["command-r-plus", "command-r", "command-a-03-2025"],
    apiKeyRequired: true,
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.5-pro"],
    apiKeyRequired: true,
  },
  {
    value: "nanogpt",
    label: "NanoGPT",
    defaultBaseUrl: "https://nano-gpt.com/api/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "claude-3.5-sonnet", "gemini-2.5-flash"],
    apiKeyRequired: true,
  },
  {
    value: "xai",
    label: "xAI / Grok",
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3",
    models: ["grok-3", "grok-3-mini", "grok-2-vision-1212"],
    apiKeyRequired: true,
  },
  {
    value: "custom",
    label: "Custom (OAI-Compatible)",
    defaultBaseUrl: "",
    defaultModel: "",
    models: ["llama-3.1-8b-instruct", "mistral-nemo", "qwen2.5-coder"],
    apiKeyRequired: false,
  },
];

export function getProviderConnectionProviderOption(
  provider: ProviderConnectionProvider | unknown,
) {
  const normalizedProvider = normalizeProviderConnectionProvider(provider);
  return (
    PROVIDER_CONNECTION_PROVIDER_OPTIONS.find((option) => option.value === normalizedProvider) ??
    PROVIDER_CONNECTION_PROVIDER_OPTIONS[0]
  );
}

function isProviderConnectionProvider(value: unknown): value is ProviderConnectionProvider {
  return (
    typeof value === "string" &&
    PROVIDER_CONNECTION_PROVIDER_VALUES.includes(value as ProviderConnectionProvider)
  );
}

export function normalizeProviderConnectionProvider(
  value: unknown,
  fallback: ProviderConnectionProvider = "custom",
): ProviderConnectionProvider {
  return isProviderConnectionProvider(value) ? value : fallback;
}

function normalizeProviderConnectionKind(value: unknown): ProviderConnectionKind {
  return value === "remote-runtime" ? value : "remote-runtime";
}

function normalizeProviderConnectionText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function sanitizeProviderConnectionRecord(
  record: ProviderConnectionRecord,
): ProviderConnectionRecord {
  const kind = normalizeProviderConnectionKind(record.kind);
  const provider = normalizeProviderConnectionProvider(record.provider, "openai");
  const providerOption = getProviderConnectionProviderOption(provider);
  const baseUrl = normalizeProviderConnectionText(record.baseUrl).trim();
  const model = normalizeProviderConnectionText(record.model).trim();
  const status =
    record.status === "ready" || record.status === "needs-key"
      ? record.status
      : providerOption.apiKeyRequired
        ? "needs-key"
        : "ready";

  return {
    id: record.id,
    schemaVersion: 1,
    kind,
    provider,
    label: normalizeProviderConnectionText(record.label).trim() || providerOption.label,
    baseUrl: baseUrl || providerOption.defaultBaseUrl,
    model: model || providerOption.defaultModel,
    summary: normalizeProviderConnectionText(record.summary),
    status,
    modelLabel:
      typeof record.modelLabel === "string" && record.modelLabel.trim()
        ? record.modelLabel.trim()
        : model || providerOption.defaultModel || null,
    keeperDefault: record.keeperDefault === true,
    maxContext:
      typeof record.maxContext === "number" && Number.isFinite(record.maxContext)
        ? Math.round(record.maxContext)
        : null,
    maxOutput:
      typeof record.maxOutput === "number" && Number.isFinite(record.maxOutput)
        ? Math.round(record.maxOutput)
        : null,
    createdAt: normalizeProviderConnectionText(record.createdAt, defaultTimestamp),
    updatedAt: normalizeProviderConnectionText(record.updatedAt, defaultTimestamp),
  };
}

const providerConnections: ProviderConnectionRecord[] = [];

export function isProviderConnectionId(value: unknown): value is ProviderConnectionId {
  return typeof value === "string" && value.trim().length > 0;
}

export function getProviderConnectionById(
  connectionId: string | null | undefined,
  connections: ProviderConnectionRecord[] = providerConnections,
) {
  const connection =
    connections.find((connection) => connection.id === connectionId) ?? connections[0] ?? null;

  return connection ? sanitizeProviderConnectionRecord(connection) : null;
}
