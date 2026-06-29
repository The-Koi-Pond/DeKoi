import type { ProviderConnectionRecord } from "../../../engine/provider-connection";

export type GenerationRuntimeMode = "remote-runtime";

export interface GenerationRuntimeSnapshot {
  mode: GenerationRuntimeMode;
  label: string;
}

export function isGenerationRuntimeMode(
  value: unknown,
): value is GenerationRuntimeMode {
  return value === "remote-runtime";
}

export function selectGenerationRuntime(
  mode: GenerationRuntimeMode = "remote-runtime",
): GenerationRuntimeSnapshot {
  return {
    mode,
    label: "Provider generation",
  };
}

export function getGenerationModeForConnection(
  connection: ProviderConnectionRecord | null | undefined,
): GenerationRuntimeMode {
  return connection?.kind ?? "remote-runtime";
}
