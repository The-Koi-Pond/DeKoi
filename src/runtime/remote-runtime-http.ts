import type { RuntimeTarget } from "./runtime-target";

export function remoteHeaders(
  target: RuntimeTarget,
  extra?: HeadersInit,
): HeadersInit {
  return {
    ...(target.authorization ? { Authorization: target.authorization } : {}),
    ...extra,
    "X-Marinara-CSRF": "1",
  };
}

export function remoteFetchInit(init: RequestInit): RequestInit {
  return {
    ...init,
    cache: "no-store",
  };
}

export async function readRemoteRuntimeError(
  response: Response,
): Promise<Error> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const message =
      typeof body.message === "string"
        ? body.message
        : `Remote runtime returned ${response.status}.`;
    return new Error(message);
  } catch {
    return new Error(`Remote runtime returned ${response.status}.`);
  }
}
