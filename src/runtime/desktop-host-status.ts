import { invoke, isTauri } from "@tauri-apps/api/core";
import { asDesktopHostErrorMessage } from "./desktop-host-common";

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
      message: `Desktop host command failed. ${asDesktopHostErrorMessage(error)}`,
    };
  }
}
