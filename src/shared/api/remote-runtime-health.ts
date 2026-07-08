import { checkDesktopRuntimeHealth } from "./desktop-runtime";
import { errorMessage } from "../errors";
import {
  fetchRemoteRuntimeJson,
  remoteHeaders,
  REMOTE_RUNTIME_HEALTH_TIMEOUT_MS,
  sanitizeRemoteRuntimeErrorDetail,
} from "./remote-runtime-http";
import type { RemoteRuntimeHealthCheck } from "./runtime-health";
import { isDesktopRuntimeUrl, readRemoteRuntimeUrl, remoteRuntimeTarget } from "./runtime-target";

const SUPPORTED_REMOTE_RUNTIME_MARKERS = new Set(["de-koi-server", "de-koi-desktop"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSupportedRemoteRuntime(value: unknown): boolean {
  return typeof value === "string" && SUPPORTED_REMOTE_RUNTIME_MARKERS.has(value);
}

function remoteRuntimeHealthErrorMessage(error: unknown): string {
  const detail = sanitizeRemoteRuntimeErrorDetail(
    errorMessage(error, "Unknown remote runtime error."),
  );
  return `Remote runtime is unreachable. ${detail}`;
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
    const response = await fetchRemoteRuntimeJson(
      `${target.baseUrl}/health?probe=1`,
      {
        method: "GET",
        headers: remoteHeaders(target, { accept: "application/json" }),
      },
      REMOTE_RUNTIME_HEALTH_TIMEOUT_MS,
      { shouldReadBody: (healthResponse) => healthResponse.ok },
    );

    if (!response.ok) {
      return {
        status: "unreachable",
        message: `Remote runtime returned ${response.status}.`,
      };
    }

    const body = isRecord(response.body) ? response.body : null;
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
  } catch (error) {
    return { status: "unreachable", message: remoteRuntimeHealthErrorMessage(error) };
  }
}
