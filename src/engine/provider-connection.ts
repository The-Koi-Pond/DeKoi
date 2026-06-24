export type ProviderConnectionId = string;

export type ProviderConnectionKind = "mock" | "remote-runtime";
export type ProviderConnectionStatus = "ready" | "needs-runtime";

export interface ProviderConnectionRecord {
  id: ProviderConnectionId;
  schemaVersion: 1;
  kind: ProviderConnectionKind;
  label: string;
  summary: string;
  status: ProviderConnectionStatus;
  modelLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LOCAL_MOCK_PROVIDER_CONNECTION_ID: ProviderConnectionId =
  "connection-local-mock";
export const REMOTE_RUNTIME_PROVIDER_CONNECTION_ID: ProviderConnectionId =
  "connection-remote-runtime";

const defaultTimestamp = "2026-06-23T09:30:00.000Z";

export const providerConnections: ProviderConnectionRecord[] = [
  {
    id: LOCAL_MOCK_PROVIDER_CONNECTION_ID,
    schemaVersion: 1,
    kind: "mock",
    label: "Local mock",
    summary: "Deterministic local replies for development and offline use.",
    status: "ready",
    modelLabel: "Mock adapter",
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
  },
  {
    id: REMOTE_RUNTIME_PROVIDER_CONNECTION_ID,
    schemaVersion: 1,
    kind: "remote-runtime",
    label: "Remote runtime",
    summary: "Sends Messenger generation requests to the configured runtime.",
    status: "needs-runtime",
    modelLabel: null,
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
  },
];

export function isProviderConnectionId(
  value: unknown,
): value is ProviderConnectionId {
  return typeof value === "string" && value.trim().length > 0;
}

export function getProviderConnectionById(
  connectionId: string | null | undefined,
  connections: ProviderConnectionRecord[] = providerConnections,
) {
  return (
    connections.find((connection) => connection.id === connectionId) ??
    connections[0] ??
    providerConnections[0]
  );
}

export function getProviderConnectionStatusLabel(
  status: ProviderConnectionStatus,
) {
  return status === "ready" ? "Ready" : "Needs runtime";
}
