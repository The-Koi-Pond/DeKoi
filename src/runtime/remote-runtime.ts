import {
  checkDesktopRuntimeHealth,
  invokeDesktopRuntime,
} from "./desktop-runtime";
import type { RemoteRuntimeHealthCheck } from "./runtime-health";
import {
  isDesktopRuntimeUrl,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
  type RuntimeTarget,
} from "./runtime-target";
import {
  REMOTE_RUNTIME_COMMANDS,
  type RemoteRuntimeCommand,
} from "./runtime-commands";

const REMOTE_RUNTIME_MARKERS = new Set([
  "de-koi-server",
  "marinara-server",
  "de-koi-desktop",
]);

const REMOTE_RUNTIME_COMMAND_SET = new Set<RemoteRuntimeCommand>(
  REMOTE_RUNTIME_COMMANDS,
);

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

function isRemoteRuntimeCommand(command: string): command is RemoteRuntimeCommand {
  return REMOTE_RUNTIME_COMMAND_SET.has(command as RemoteRuntimeCommand);
}

export async function checkRemoteRuntimeHealth(rawUrl = readRemoteRuntimeUrl()): Promise<RemoteRuntimeHealthCheck> {
  if (!rawUrl.trim()) {
    return { status: "unconfigured", message: "Remote Runtime URL is not set." };
  }

  if (isDesktopRuntimeUrl(rawUrl)) {
    return await checkDesktopRuntimeHealth();
  }

  let target: RuntimeTarget | null;
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
  command: RemoteRuntimeCommand,
  args?: Record<string, unknown>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<T> {
  if (!isRemoteRuntimeCommand(command)) {
    throw new Error(`Remote runtime command is not supported: ${command}`);
  }

  if (isDesktopRuntimeUrl(rawUrl)) {
    return await invokeDesktopRuntime<T>(command, args);
  }

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
