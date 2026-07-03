import {
  getProviderConnectionProviderOption,
  type ProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";

export type GenerationRuntimeMode = "remote-runtime";

export interface GenerationRuntimeSnapshot {
  mode: GenerationRuntimeMode;
  label: string;
}

export type GenerationConnectionReadinessFailureCode =
  | "missing-connection"
  | "connection-needs-key"
  | "missing-base-url"
  | "missing-model"
  | "desktop-key-store-unavailable";

export type GenerationConnectionReadiness =
  | {
      ready: true;
      connection: ProviderConnectionRecord;
    }
  | {
      ready: false;
      code: GenerationConnectionReadinessFailureCode;
    };

export function isGenerationRuntimeMode(value: unknown): value is GenerationRuntimeMode {
  return value === "remote-runtime";
}

export function selectGenerationRuntime(
  mode: GenerationRuntimeMode = "remote-runtime",
): GenerationRuntimeSnapshot {
  if (!isGenerationRuntimeMode(mode)) {
    throw new Error(`Unsupported generation runtime mode: ${String(mode)}.`);
  }

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

export function getGenerationConnectionReadiness(
  connection: ProviderConnectionRecord | null | undefined,
): GenerationConnectionReadiness {
  if (!connection) {
    return {
      ready: false,
      code: "missing-connection",
    };
  }

  if (connection.status !== "ready") {
    return {
      ready: false,
      code: "connection-needs-key",
    };
  }

  if (!connection.baseUrl.trim()) {
    return {
      ready: false,
      code: "missing-base-url",
    };
  }

  if (!connection.model.trim()) {
    return {
      ready: false,
      code: "missing-model",
    };
  }

  const providerOption = getProviderConnectionProviderOption(connection.provider);
  if (providerOption.apiKeyRequired && !isDesktopHostAvailable()) {
    return {
      ready: false,
      code: "desktop-key-store-unavailable",
    };
  }

  return { ready: true, connection };
}
