import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";

export interface ConnectionCatalogCard {
  id: string;
  label: string;
  status: ProviderConnectionRecord["status"];
  subtitle: string;
}

export function getConnectionCatalogCards(
  providerConnections: readonly ProviderConnectionRecord[],
): ConnectionCatalogCard[] {
  return providerConnections.map((rawConnection) => {
    const connection = sanitizeProviderConnectionRecord(rawConnection);
    const provider = getProviderConnectionProviderOption(connection.provider);

    return {
      id: connection.id,
      label: connection.label,
      status: connection.status,
      subtitle: [provider.label, connection.model].filter(Boolean).join(" / "),
    };
  });
}
