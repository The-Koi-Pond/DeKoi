import type { RuntimeTarget } from "./runtime-target";
import {
  fetchJsonWithTimeout,
  formatTimeoutDuration,
  type FetchJsonWithTimeoutOptions,
} from "./http-timeout";

/** Default timeout for remote runtime commands other than generation. */
export const REMOTE_RUNTIME_COMMAND_TIMEOUT_MS = 30_000;
/** Longer timeout for remote runtime provider-backed generation. */
export const REMOTE_RUNTIME_GENERATION_TIMEOUT_MS = 120_000;

/** Short timeout for remote runtime health probes. */
export const REMOTE_RUNTIME_HEALTH_TIMEOUT_MS = 5_000;

export function remoteHeaders(target: RuntimeTarget, extra?: HeadersInit): HeadersInit {
  return {
    ...(target.authorization ? { Authorization: target.authorization } : {}),
    ...extra,
    "X-DeKoi-CSRF": "1",
  };
}

function remoteFetchInit(init: RequestInit): RequestInit {
  return {
    ...init,
    cache: "no-store",
  };
}

/** Fetches remote-runtime JSON with no-store caching and status-preserving body handling. */
export async function fetchRemoteRuntimeJson(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = REMOTE_RUNTIME_COMMAND_TIMEOUT_MS,
  options: FetchJsonWithTimeoutOptions = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const { response, body } = await fetchJsonWithTimeout(
    input,
    remoteFetchInit(init),
    timeoutMs,
    `Remote runtime request timed out after ${formatTimeoutDuration(timeoutMs)}.`,
    options,
  );

  return { ok: response.ok, status: response.status, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const AUTH_HEADER_DETAIL_PATTERN =
  /((?:["']?\bauthorization\b["']?\s*(?::|=)\s*["']?)(?:Basic|Bearer)\s+)[^"',\s)]+/gi;
const URL_USERINFO_PATTERN = /\b([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/gi;

/**
 * Redacts authorization tokens and URL userinfo from surfaced remote-runtime
 * diagnostics.
 */
export function sanitizeRemoteRuntimeErrorDetail(detail: string): string {
  return detail
    .replace(AUTH_HEADER_DETAIL_PATTERN, "$1[redacted]")
    .replace(URL_USERINFO_PATTERN, "$1[redacted]@");
}

/** Builds the surfaced runtime error, preferring a JSON message when available. */
export function readRemoteRuntimeError(status: number, body: unknown): Error {
  const message =
    isRecord(body) && typeof body.message === "string"
      ? body.message
      : `Remote runtime returned ${status}.`;
  return new Error(message);
}
