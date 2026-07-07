import { invokeDesktopRuntime } from "./desktop-runtime";
import { isDesktopHostAvailable } from "./desktop-host-common";
import {
  fetchRemoteRuntimeJson,
  REMOTE_RUNTIME_COMMAND_TIMEOUT_MS,
  REMOTE_RUNTIME_GENERATION_TIMEOUT_MS,
  readRemoteRuntimeError,
  remoteHeaders,
} from "./remote-runtime-http";
import {
  REMOTE_RUNTIME_COMMANDS,
  RUNTIME_COMMANDS,
  type RemoteRuntimeCommand,
} from "./runtime-commands";
import { isDesktopRuntimeUrl, readRemoteRuntimeUrl, remoteRuntimeTarget } from "./runtime-target";

const REMOTE_RUNTIME_COMMAND_SET = new Set<RemoteRuntimeCommand>(REMOTE_RUNTIME_COMMANDS);

function isRemoteRuntimeCommand(command: string): command is RemoteRuntimeCommand {
  return REMOTE_RUNTIME_COMMAND_SET.has(command as RemoteRuntimeCommand);
}

function remoteRuntimeInvokeTimeoutMs(command: RemoteRuntimeCommand) {
  return command === RUNTIME_COMMANDS.generationGenerate
    ? REMOTE_RUNTIME_GENERATION_TIMEOUT_MS
    : REMOTE_RUNTIME_COMMAND_TIMEOUT_MS;
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

  const response = await fetchRemoteRuntimeJson(
    `${target.baseUrl}/api/invoke`,
    {
      method: "POST",
      headers: remoteHeaders(target, { "content-type": "application/json" }),
      body: JSON.stringify({ command, args: args ?? null }),
    },
    remoteRuntimeInvokeTimeoutMs(command),
  );

  if (!response.ok) throw readRemoteRuntimeError(response.status, response.body);
  return response.body as T;
}
