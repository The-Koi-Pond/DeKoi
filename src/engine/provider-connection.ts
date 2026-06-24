export type ProviderConnectionId =
  | "connection-local-mock"
  | "connection-remote-runtime";

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
}

export const LOCAL_MOCK_PROVIDER_CONNECTION_ID: ProviderConnectionId =
  "connection-local-mock";

export const providerConnections: ProviderConnectionRecord[] = [
  {
    id: LOCAL_MOCK_PROVIDER_CONNECTION_ID,
    schemaVersion: 1,
    kind: "mock",
    label: "Local mock",
    summary: "Deterministic local replies for development and offline use.",
    status: "ready",
    modelLabel: "Mock adapter",
  },
  {
    id: "connection-remote-runtime",
    schemaVersion: 1,
    kind: "remote-runtime",
    label: "Remote runtime",
    summary: "Sends Messenger generation requests to the configured runtime.",
    status: "needs-runtime",
    modelLabel: null,
  },
];

export function isProviderConnectionId(
  value: unknown,
): value is ProviderConnectionId {
  return (
    value === "connection-local-mock" || value === "connection-remote-runtime"
  );
}

export function getProviderConnectionById(
  connectionId: string | null | undefined,
) {
  return (
    providerConnections.find((connection) => connection.id === connectionId) ??
    providerConnections[0]
  );
}

export function getProviderConnectionStatusLabel(
  status: ProviderConnectionStatus,
) {
  return status === "ready" ? "Ready" : "Needs runtime";
}
