import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";

export interface DeKoiDesktopProviderSecretStatus {
  connectionId: string;
  hasSecret: boolean;
}

function requireTauriForSecrets() {
  requireTauriForDesktopHost(
    "Desktop provider key storage is only available inside the Tauri app.",
  );
}

export async function getDesktopProviderSecretStatus(
  connectionId: string,
): Promise<DeKoiDesktopProviderSecretStatus> {
  requireTauriForSecrets();

  return await invoke<DeKoiDesktopProviderSecretStatus>(
    DESKTOP_COMMANDS.providerSecretStatus,
    { connectionId },
  );
}

export async function writeDesktopProviderSecret(
  connectionId: string,
  secret: string,
  scope?: { provider?: string; baseUrl?: string },
): Promise<DeKoiDesktopProviderSecretStatus> {
  requireTauriForSecrets();

  return await invoke<DeKoiDesktopProviderSecretStatus>(
    DESKTOP_COMMANDS.providerSecretWrite,
    { connectionId, secret, provider: scope?.provider, baseUrl: scope?.baseUrl },
  );
}

export async function deleteDesktopProviderSecret(
  connectionId: string,
): Promise<DeKoiDesktopProviderSecretStatus> {
  requireTauriForSecrets();

  return await invoke<DeKoiDesktopProviderSecretStatus>(
    DESKTOP_COMMANDS.providerSecretDelete,
    { connectionId },
  );
}
