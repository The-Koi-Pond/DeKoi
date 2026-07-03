export const DESKTOP_RUNTIME_URL = "desktop://runtime";

let sessionRemoteRuntimeUrl = "";

export type RuntimeTarget = {
  baseUrl: string;
  authorization?: string;
};

function encodeBasicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`)}`;
}

function normalizeRemoteRuntimeUrl(raw: string): RuntimeTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isDesktopRuntimeUrl(trimmed)) return { baseUrl: DESKTOP_RUNTIME_URL };

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

export function isDesktopRuntimeUrl(rawUrl: string) {
  return rawUrl.trim().toLowerCase() === DESKTOP_RUNTIME_URL;
}

export function readRemoteRuntimeUrl(): string {
  return sessionRemoteRuntimeUrl || import.meta.env.VITE_DEKOI_REMOTE_RUNTIME_URL || "";
}

export function writeRemoteRuntimeUrl(url: string) {
  sessionRemoteRuntimeUrl = url.trim();
}

export function remoteRuntimeTarget(rawUrl = readRemoteRuntimeUrl()): RuntimeTarget | null {
  try {
    return normalizeRemoteRuntimeUrl(rawUrl);
  } catch {
    throw new Error("Invalid Remote Runtime URL.");
  }
}
