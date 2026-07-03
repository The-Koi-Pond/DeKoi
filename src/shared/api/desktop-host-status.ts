import { invoke } from "@tauri-apps/api/core";
import { asDesktopHostErrorMessage, isDesktopHostAvailable } from "./desktop-host-common";
import { DESKTOP_COMMANDS } from "./desktop-commands";

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
  if (!isDesktopHostAvailable()) return BROWSER_HOST_STATUS;

  try {
    return await invoke<DeKoiDesktopHostStatus>(DESKTOP_COMMANDS.hostStatus);
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
