import {
  getProviderConnectionGenerationBlocker,
  getProviderConnectionProviderOption,
  isProviderConnectionReady,
  type ProviderConnectionRecord,
} from "../../../engine/provider-connection";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";

export type GenerationRuntimeMode = "remote-runtime";

export interface GenerationRuntimeSnapshot {
  mode: GenerationRuntimeMode;
  label: string;
}

export type GenerationConnectionReadiness =
  | {
      ready: true;
      connection: ProviderConnectionRecord;
    }
  | {
      ready: false;
      message: string;
    };

const missingConnectionMessage = "Create or select a connection before generating.";
const desktopKeyStoreMessage =
  "Provider API keys are only available in the desktop app. Open DeKoi desktop or choose a connection that does not require a key.";

export function isGenerationRuntimeMode(
  value: unknown,
): value is GenerationRuntimeMode {
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
  const blocker = getProviderConnectionGenerationBlocker(connection);
  if (blocker || !isProviderConnectionReady(connection)) {
    return {
      ready: false,
      message: blocker ?? missingConnectionMessage,
    };
  }

  const providerOption = getProviderConnectionProviderOption(connection.provider);
  if (providerOption.apiKeyRequired && !isDesktopHostAvailable()) {
    return {
      ready: false,
      message: desktopKeyStoreMessage,
    };
  }

  return { ready: true, connection };
}
