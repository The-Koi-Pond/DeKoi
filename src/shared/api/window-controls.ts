import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

function currentWindow() {
  if (!isTauri()) return null;
  return getCurrentWindow();
}

export async function closeDesktopWindow() {
  await currentWindow()?.close();
}

export async function minimizeDesktopWindow() {
  await currentWindow()?.minimize();
}

export async function startDesktopWindowDrag() {
  await currentWindow()?.startDragging();
}

export async function toggleDesktopWindowMaximize() {
  await currentWindow()?.toggleMaximize();
}
