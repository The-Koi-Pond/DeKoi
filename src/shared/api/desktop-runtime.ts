import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "../errors";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { isDesktopHostAvailable } from "./desktop-host-common";
import type { RemoteRuntimeHealthCheck } from "./runtime-health";
import type { RemoteRuntimeCommand } from "./runtime-commands";

const DESKTOP_RUNTIME_MARKER = "de-koi-desktop";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function checkDesktopRuntimeHealth(): Promise<RemoteRuntimeHealthCheck> {
  if (!isDesktopHostAvailable()) {
    return {
      status: "unreachable",
      message: "Desktop runtime is only available inside the Tauri app.",
    };
  }

  try {
    const body = await invoke<unknown>(DESKTOP_COMMANDS.runtimeHealth);
    if (!isRecord(body) || body.ok !== true || body.runtime !== DESKTOP_RUNTIME_MARKER) {
      return {
        status: "unreachable",
        message: "Desktop runtime health response is not compatible.",
      };
    }

    if (body.writable !== true) {
      return {
        status: "not-writable",
        message: "Desktop runtime is reachable, but storage is read-only.",
      };
    }

    return { status: "ok", message: "Desktop runtime is online." };
  } catch (error) {
    return {
      status: "unreachable",
      message: `Desktop runtime is unavailable. ${errorMessage(error, "Unknown desktop runtime error.")}`,
    };
  }
}

export async function invokeDesktopRuntime<T>(
  command: RemoteRuntimeCommand,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isDesktopHostAvailable()) {
    throw new Error("Desktop runtime is only available inside the Tauri app.");
  }

  return await invoke<T>(DESKTOP_COMMANDS.runtimeInvoke, {
    command,
    args: args ?? null,
  });
}
