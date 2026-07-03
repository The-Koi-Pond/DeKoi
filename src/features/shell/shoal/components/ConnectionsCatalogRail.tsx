import {
  useConnectionsCatalogRailController,
  type ConnectionsCatalogRailNav,
} from "../hooks/use-connections-catalog-rail-controller";
import { ConnectionsCatalogHead } from "./ConnectionsCatalogHead";
import { ConnectionsCatalogList } from "./ConnectionsCatalogList";
import { ShoalTopBar } from "./ShoalTopBar";

interface ConnectionsCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: ConnectionsCatalogRailNav;
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
  const { activeConnectionId, connections, openConnection, openNewConnection } =
    useConnectionsCatalogRailController({ nav });

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
          onOpenConnection={openConnection}
        />
      </div>
    </aside>
  );
}
