import type { ProviderConnectionRecord } from "../../../engine/provider-connection";

export type GenerationRuntimeMode = "mock" | "remote-runtime";

export interface GenerationRuntimeSnapshot {
  mode: GenerationRuntimeMode;
  label: string;
}

export function isGenerationRuntimeMode(
  value: unknown,
): value is GenerationRuntimeMode {
  return value === "mock" || value === "remote-runtime";
}

export function selectGenerationRuntime(
  mode: GenerationRuntimeMode = "mock",
): GenerationRuntimeSnapshot {
  if (mode === "remote-runtime") {
    return {
      mode: "remote-runtime",
      label: "Provider generation",
    };
  }

  return {
    mode: "mock",
    label: "Mock generation",
  };
}

export function getGenerationModeForConnection(
  connection: ProviderConnectionRecord | null | undefined,
): GenerationRuntimeMode {
  return connection?.kind === "remote-runtime" ? "remote-runtime" : "mock";
}
