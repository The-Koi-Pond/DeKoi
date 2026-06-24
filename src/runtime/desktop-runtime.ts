import { invoke, isTauri } from "@tauri-apps/api/core";
import type { RemoteRuntimeHealthCheck } from "./runtime-health";
import type { RemoteRuntimeCommand } from "./runtime-commands";
import {
  DESKTOP_RUNTIME_URL,
  isDesktopRuntimeUrl,
} from "./runtime-target";

export { DESKTOP_RUNTIME_URL, isDesktopRuntimeUrl };

const DESKTOP_RUNTIME_MARKER = "de-koi-desktop";

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function checkDesktopRuntimeHealth(): Promise<RemoteRuntimeHealthCheck> {
  if (!isTauri()) {
    return {
      status: "unreachable",
      message: "Desktop runtime is only available inside the Tauri app.",
    };
  }

  try {
    const body = await invoke<unknown>("dekoi_runtime_health");
    if (
      !isRecord(body) ||
      body.ok !== true ||
      body.runtime !== DESKTOP_RUNTIME_MARKER
    ) {
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
      message: `Desktop runtime is unavailable. ${asErrorMessage(error)}`,
    };
  }
}

export async function invokeDesktopRuntime<T>(
  command: RemoteRuntimeCommand,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new Error("Desktop runtime is only available inside the Tauri app.");
  }

  return await invoke<T>("dekoi_runtime_invoke", {
    command,
    args: args ?? null,
  });
}
