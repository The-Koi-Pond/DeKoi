const REMOTE_RUNTIME_URL_STORAGE_KEY = "dekoi:remote-runtime-url";
const REMOTE_RUNTIME_MARKERS = new Set(["de-koi-server", "marinara-server"]);

export type RuntimeTarget = {
  baseUrl: string;
  authorization?: string;
};

export type RemoteRuntimeHealthCheck =
  | { status: "ok"; message: string }
  | { status: "unconfigured"; message: string }
  | { status: "invalid"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "not-writable"; message: string };

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function encodeBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`)}`;
}

function normalizeRemoteRuntimeUrl(raw: string): RuntimeTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const url = new URL(trimmed);
  let authorization: string | undefined;
  if (url.username || url.password) {
    authorization = encodeBasicAuth(url.username, url.password);
    url.username = "";
    url.password = "";
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";

  return { baseUrl: url.toString().replace(/\/+$/, ""), authorization };
}

export function readRemoteRuntimeUrl(): string {
  if (hasLocalStorage()) {
    const storedUrl = window.localStorage.getItem(REMOTE_RUNTIME_URL_STORAGE_KEY);
    if (storedUrl !== null) return storedUrl;
  }

  return import.meta.env.VITE_DEKOI_REMOTE_RUNTIME_URL ?? "";
}

export function writeRemoteRuntimeUrl(url: string) {
  if (!hasLocalStorage()) return;

  window.localStorage.setItem(REMOTE_RUNTIME_URL_STORAGE_KEY, url.trim());
}

export function remoteRuntimeTarget(rawUrl = readRemoteRuntimeUrl()): RuntimeTarget | null {
  try {
    return normalizeRemoteRuntimeUrl(rawUrl);
  } catch {
    throw new Error("Invalid Remote Runtime URL.");
  }
}

function remoteHeaders(target: RuntimeTarget, extra?: HeadersInit): HeadersInit {
  return {
    ...(target.authorization ? { Authorization: target.authorization } : {}),
    ...extra,
    "X-Marinara-CSRF": "1",
  };
}

function remoteFetchInit(init: RequestInit): RequestInit {
  return {
    ...init,
    cache: "no-store",
  };
}

function isSupportedRemoteRuntime(value: unknown): boolean {
  return typeof value === "string" && REMOTE_RUNTIME_MARKERS.has(value);
}

export async function checkRemoteRuntimeHealth(rawUrl = readRemoteRuntimeUrl()): Promise<RemoteRuntimeHealthCheck> {
  if (!rawUrl.trim()) {
    return { status: "unconfigured", message: "Remote Runtime URL is not set." };
  }

  let target: RuntimeTarget | null;
  try {
    target = normalizeRemoteRuntimeUrl(rawUrl);
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
      return { status: "unreachable", message: `Remote runtime returned ${response.status}.` };
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || body.ok !== true || !isSupportedRemoteRuntime(body.runtime)) {
      return { status: "unreachable", message: "Remote runtime health response is not compatible." };
    }

    if (body.writable !== true) {
      return { status: "not-writable", message: "Remote runtime is reachable, but storage is read-only." };
    }

    return { status: "ok", message: "Remote runtime is online." };
  } catch {
    return { status: "unreachable", message: "Remote runtime is unreachable." };
  }
}

async function readRemoteError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message : `Remote runtime returned ${response.status}.`;
    return new Error(message);
  } catch {
    return new Error(`Remote runtime returned ${response.status}.`);
  }
}

export async function invokeRemote<T>(
  command: string,
  args?: Record<string, unknown>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<T> {
  const target = remoteRuntimeTarget(rawUrl);
  if (!target) throw new Error("Remote Runtime URL is not set.");

  const response = await fetch(
    `${target.baseUrl}/api/invoke`,
    remoteFetchInit({
      method: "POST",
      headers: remoteHeaders(target, { "content-type": "application/json" }),
      body: JSON.stringify({ command, args: args ?? null }),
    }),
  );

  if (!response.ok) throw await readRemoteError(response);
  return (await response.json()) as T;
}
