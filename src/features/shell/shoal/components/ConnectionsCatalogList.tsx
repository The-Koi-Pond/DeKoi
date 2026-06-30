import { getMessengerThreadInitials } from "../../../modes";
import type { ConnectionCatalogCard } from "../lib/connection-catalog-view-model";
import { CatalogRailCard } from "./CatalogRailCard";

interface ConnectionsCatalogListProps {
  activeConnectionId: string | null;
  connections: readonly ConnectionCatalogCard[];
  onOpenConnection: (connectionId: string) => void;
}

export function ConnectionsCatalogList({
  activeConnectionId,
  connections,
  onOpenConnection,
}: ConnectionsCatalogListProps) {
  return (
    <div className="shoal-list">
      {connections.map((connection) => (
        <CatalogRailCard
          key={connection.id}
          active={connection.id === activeConnectionId}
          initials={getMessengerThreadInitials(connection.label)}
          name={connection.label}
          sub={connection.subtitle}
          tone={connection.status === "ready" ? "jade" : "amber"}
          onOpen={() => onOpenConnection(connection.id)}
        />
      ))}
      {connections.length === 0 && (
        <div className="shoal-empty">
          <p>No connections yet.</p>
        </div>
      )}
    </div>
  );
}
