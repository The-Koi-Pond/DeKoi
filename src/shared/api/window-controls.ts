import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

function currentWindow() {
  if (!isTauri()) return null;
  return getCurrentWindow();
}

export interface DesktopWindowState {
  minimized: boolean;
  maximized: boolean;
}

export async function closeDesktopWindow() {
  await currentWindow()?.close();
}

export async function getDesktopWindowState(): Promise<DesktopWindowState> {
  const window = currentWindow();
  if (!window) return { minimized: false, maximized: false };

  const [minimized, maximized] = await Promise.all([window.isMinimized(), window.isMaximized()]);

  return { minimized, maximized };
}

export async function minimizeDesktopWindow() {
  await currentWindow()?.minimize();
}

export async function restoreDesktopWindow() {
  await currentWindow()?.unminimize();
}

export async function startDesktopWindowDrag() {
  await currentWindow()?.startDragging();
}

export async function toggleDesktopWindowMaximize() {
  await currentWindow()?.toggleMaximize();
}
