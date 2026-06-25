import { isTauri } from "@tauri-apps/api/core";

export function asDesktopHostErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isDesktopHostAvailable() {
  return isTauri();
}

export function requireTauriForDesktopHost(message: string) {
  if (!isDesktopHostAvailable()) throw new Error(message);
}
