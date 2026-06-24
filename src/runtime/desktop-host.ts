import { invoke, isTauri } from "@tauri-apps/api/core";

export interface DeKoiDesktopHostStatus {
  appName: string;
  hostKind: "browser" | "tauri";
  storageReady: boolean;
  secretsReady: boolean;
  runtimeReady: boolean;
  message: string;
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
