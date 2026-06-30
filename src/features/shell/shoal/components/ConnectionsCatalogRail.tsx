import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
  type ProviderConnectionRecord,
} from "../../../../engine/contracts/types/provider-connection";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";
import { FolderIcon } from "./ShoalIcons";
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
    nav.view.kind === "connections" ? nav.view.connectionId : null;

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
        <div className="shoal-head">
          <div className="shoal-title">
            <h2>
              <span className="shoal-symbol" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M10.2 13.8a4.2 4.2 0 0 0 5.9 0l2-2a4.2 4.2 0 0 0-5.9-5.9l-1.1 1.1" />
                  <path d="M13.8 10.2a4.2 4.2 0 0 0-5.9 0l-2 2a4.2 4.2 0 0 0 5.9 5.9l1.1-1.1" />
                </svg>
              </span>
              Connections
            </h2>
          </div>
          <div className="shoal-actions">
            <button className="pill koi" type="button" onClick={openNewConnection}>
              ＋ Connection
            </button>
            <button
              className="pill koi title-folder"
              type="button"
              title="Add grouping folder"
              aria-label="Add grouping folder"
              disabled
            >
              <FolderIcon />
              Folder
            </button>
          </div>
        </div>
        <div className="shoal-list">
          {nav.providerConnections.map((rawConnection) => {
            const connection = sanitizeProviderConnectionRecord(rawConnection);
            const provider = getProviderConnectionProviderOption(connection.provider);
            const subtitle = [provider.label, connection.model]
              .filter(Boolean)
              .join(" / ");

            return (
              <CatalogRailCard
                key={connection.id}
                active={connection.id === activeConnectionId}
                initials={getMessengerThreadInitials(connection.label)}
                name={connection.label}
                sub={subtitle}
                tone={connection.status === "ready" ? "jade" : "amber"}
                onOpen={() =>
                  nav.setView({ kind: "connections", connectionId: connection.id })
                }
              />
            );
          })}
          {nav.providerConnections.length === 0 && (
            <div className="shoal-empty">
              <p>No connections yet.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
