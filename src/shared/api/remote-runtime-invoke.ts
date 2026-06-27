import { invokeDesktopRuntime } from "./desktop-runtime";
import { isDesktopHostAvailable } from "./desktop-host-common";
import {
  readRemoteRuntimeError,
  remoteFetchInit,
  remoteHeaders,
} from "./remote-runtime-http";
import {
  REMOTE_RUNTIME_COMMANDS,
  type RemoteRuntimeCommand,
} from "./runtime-commands";
import {
  isDesktopRuntimeUrl,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "./runtime-target";

const REMOTE_RUNTIME_COMMAND_SET = new Set<RemoteRuntimeCommand>(
  REMOTE_RUNTIME_COMMANDS,
);

export function isRemoteRuntimeCommand(
  command: string,
): command is RemoteRuntimeCommand {
  return REMOTE_RUNTIME_COMMAND_SET.has(command as RemoteRuntimeCommand);
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

  if (!rawUrl.trim() && isDesktopHostAvailable()) {
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

  if (!response.ok) throw await readRemoteRuntimeError(response);
  return (await response.json()) as T;
}
