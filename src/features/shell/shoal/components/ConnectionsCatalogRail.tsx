import { useMemo } from "react";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { getConnectionCatalogCards } from "../lib/connection-catalog-view-model";
import { ConnectionsCatalogHead } from "./ConnectionsCatalogHead";
import { ConnectionsCatalogList } from "./ConnectionsCatalogList";
import { ShoalTopBar } from "./ShoalTopBar";

interface ConnectionsCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: {
    providerConnections: ProviderConnectionRecord[];
    selectedSurface: string;
    setView: (
      view:
        | { kind: "connections"; connectionId: string }
        | { kind: "connections"; mode: "new" },
    ) => void;
    view: {
      connectionId?: string;
      kind: string;
    };
  };
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function ConnectionsCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ConnectionsCatalogRailProps) {
  const activeConnectionId =
    nav.view.kind === "connections" ? nav.view.connectionId ?? null : null;
  const connections = useMemo(
    () => getConnectionCatalogCards(nav.providerConnections),
    [nav.providerConnections],
  );

  function openNewConnection() {
    nav.setView({ kind: "connections", mode: "new" });
  }

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — connections">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <ConnectionsCatalogHead onCreateConnection={openNewConnection} />
        <ConnectionsCatalogList
          activeConnectionId={activeConnectionId}
          connections={connections}
          onOpenConnection={(connectionId) =>
            nav.setView({ kind: "connections", connectionId })
          }
        />
      </div>
    </aside>
  );
}
