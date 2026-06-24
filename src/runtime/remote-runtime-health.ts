import { checkDesktopRuntimeHealth } from "./desktop-runtime";
import {
  remoteFetchInit,
  remoteHeaders,
} from "./remote-runtime-http";
import type { RemoteRuntimeHealthCheck } from "./runtime-health";
import {
  isDesktopRuntimeUrl,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "./runtime-target";

const SUPPORTED_REMOTE_RUNTIME_MARKERS = new Set([
  "de-koi-server",
  "marinara-server",
  "de-koi-desktop",
]);

function isSupportedRemoteRuntime(value: unknown): boolean {
  return (
    typeof value === "string" && SUPPORTED_REMOTE_RUNTIME_MARKERS.has(value)
  );
}

export async function checkRemoteRuntimeHealth(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<RemoteRuntimeHealthCheck> {
  if (!rawUrl.trim()) {
    return { status: "unconfigured", message: "Remote Runtime URL is not set." };
  }

  if (isDesktopRuntimeUrl(rawUrl)) {
    return await checkDesktopRuntimeHealth();
  }

  let target;
  try {
    target = remoteRuntimeTarget(rawUrl);
  } catch {
    return { status: "invalid", message: "Remote Runtime URL is invalid." };
  }

  if (!target) {
    return { status: "unconfigured", message: "Remote Runtime URL is not set." };
  }

  try {
    const response = await fetch(
      `${target.baseUrl}/health?probe=1`,
      remoteFetchInit({
        method: "GET",
        headers: remoteHeaders(target, { accept: "application/json" }),
      }),
    );

    if (!response.ok) {
      return {
        status: "unreachable",
        message: `Remote runtime returned ${response.status}.`,
      };
    }

    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || body.ok !== true || !isSupportedRemoteRuntime(body.runtime)) {
      return {
        status: "unreachable",
        message: "Remote runtime health response is not compatible.",
      };
    }

    if (body.writable !== true) {
      return {
        status: "not-writable",
        message: "Remote runtime is reachable, but storage is read-only.",
      };
    }

    return { status: "ok", message: "Remote runtime is online." };
  } catch {
    return { status: "unreachable", message: "Remote runtime is unreachable." };
  }
}
