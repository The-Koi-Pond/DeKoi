import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";

function requireTauriForDesktopPromptPresetFile() {
  requireTauriForDesktopHost(
    "Desktop prompt preset files are only available inside the Tauri app.",
  );
}

export async function exportDesktopPromptPresetFile(
  packageValue: unknown,
  defaultFileName: string,
): Promise<string | null> {
  requireTauriForDesktopPromptPresetFile();

  return await invoke<string | null>(DESKTOP_COMMANDS.fileExportPromptPreset, {
    package: packageValue,
    defaultFileName,
  });
}

export async function importDesktopPromptPresetFile(): Promise<string | null> {
  requireTauriForDesktopPromptPresetFile();

  return await invoke<string | null>(DESKTOP_COMMANDS.fileImportPromptPreset);
}
