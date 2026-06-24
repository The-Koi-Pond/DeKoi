import { invoke } from "@tauri-apps/api/core";
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
    "dekoi_provider_secret_status",
    { connectionId },
  );
}

export async function writeDesktopProviderSecret(
  connectionId: string,
  secret: string,
): Promise<DeKoiDesktopProviderSecretStatus> {
  requireTauriForSecrets();

  return await invoke<DeKoiDesktopProviderSecretStatus>(
    "dekoi_provider_secret_write",
    { connectionId, secret },
  );
}

export async function deleteDesktopProviderSecret(
  connectionId: string,
): Promise<DeKoiDesktopProviderSecretStatus> {
  requireTauriForSecrets();

  return await invoke<DeKoiDesktopProviderSecretStatus>(
    "dekoi_provider_secret_delete",
    { connectionId },
  );
}
