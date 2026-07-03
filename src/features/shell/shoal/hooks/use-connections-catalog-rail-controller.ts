import { useMemo } from "react";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { getConnectionCatalogCards } from "../lib/connection-catalog-view-model";

export interface ConnectionsCatalogRailNav {
  providerConnections: ProviderConnectionRecord[];
  selectedSurface: string;
  setView: (
    view: { kind: "connections"; connectionId: string } | { kind: "connections"; mode: "new" },
  ) => void;
  view: {
    connectionId?: string;
    kind: string;
  };
}

interface UseConnectionsCatalogRailControllerInput {
  nav: ConnectionsCatalogRailNav;
}

export function useConnectionsCatalogRailController({
  nav,
}: UseConnectionsCatalogRailControllerInput) {
  const activeConnectionId =
    nav.view.kind === "connections" ? (nav.view.connectionId ?? null) : null;
  const connections = useMemo(
    () => getConnectionCatalogCards(nav.providerConnections),
    [nav.providerConnections],
  );

  function openNewConnection() {
    nav.setView({ kind: "connections", mode: "new" });
  }

  function openConnection(connectionId: string) {
    nav.setView({ kind: "connections", connectionId });
  }

  return {
    activeConnectionId,
    connections,
    openConnection,
    openNewConnection,
  };
}
