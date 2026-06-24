import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  normalizeDeKoiStorageBundle,
  type DeKoiStorageBundle,
} from "./dekoi-storage-bundle";

export interface DeKoiDesktopHostStatus {
  appName: string;
  hostKind: "browser" | "tauri";
  storageReady: boolean;
  secretsReady: boolean;
  runtimeReady: boolean;
  message: string;
}

export interface DeKoiDesktopStorageBundleInfo {
  path: string;
  byteLength: number;
  updatedAtMs: number | null;
}

interface DeKoiDesktopStorageBundleSnapshot
  extends DeKoiDesktopStorageBundleInfo {
  bundle: unknown;
}

export type DeKoiDesktopStorageReadResult =
  | {
      ok: true;
      bundle: DeKoiStorageBundle;
      info: DeKoiDesktopStorageBundleInfo;
      warnings: string[];
    }
  | { ok: false; error: string };

export interface DeKoiDesktopProviderSecretStatus {
  connectionId: string;
  hasSecret: boolean;
}

const BROWSER_HOST_STATUS: DeKoiDesktopHostStatus = {
  appName: "DeKoi",
  hostKind: "browser",
  storageReady: false,
  secretsReady: false,
  runtimeReady: false,
  message: "Running in the browser. Native desktop host capabilities are unavailable.",
};

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function checkDesktopHostStatus(): Promise<DeKoiDesktopHostStatus> {
  if (!isTauri()) return BROWSER_HOST_STATUS;

  try {
    return await invoke<DeKoiDesktopHostStatus>("dekoi_host_status");
  } catch (error) {
    return {
      appName: "DeKoi",
      hostKind: "tauri",
      storageReady: false,
      secretsReady: false,
      runtimeReady: false,
      message: `Desktop host command failed. ${asErrorMessage(error)}`,
    };
  }
}

export async function readDesktopStorageBundle(): Promise<DeKoiDesktopStorageReadResult> {
  if (!isTauri()) {
    return {
      ok: false,
      error: "Desktop host storage is only available inside the Tauri app.",
    };
  }

  let snapshot: DeKoiDesktopStorageBundleSnapshot | null;
  try {
    snapshot =
      await invoke<DeKoiDesktopStorageBundleSnapshot | null>(
        "dekoi_storage_read_bundle",
      );
  } catch (error) {
    return { ok: false, error: asErrorMessage(error) };
  }

  if (!snapshot) {
    return { ok: false, error: "No desktop host bundle has been saved yet." };
  }

  const normalized = normalizeDeKoiStorageBundle(snapshot.bundle);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  return {
    ok: true,
    bundle: normalized.preview.bundle,
    info: {
      path: snapshot.path,
      byteLength: snapshot.byteLength,
      updatedAtMs: snapshot.updatedAtMs,
    },
    warnings: normalized.preview.warnings,
  };
}

export async function writeDesktopStorageBundle(
  bundle: DeKoiStorageBundle,
): Promise<DeKoiDesktopStorageBundleInfo> {
  if (!isTauri()) {
    throw new Error(
      "Desktop host storage is only available inside the Tauri app.",
    );
  }

  return await invoke<DeKoiDesktopStorageBundleInfo>(
    "dekoi_storage_write_bundle",
    { bundle },
  );
}

function requireTauriForSecrets() {
  if (!isTauri()) {
    throw new Error(
      "Desktop provider key storage is only available inside the Tauri app.",
    );
  }
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
