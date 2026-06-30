import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";

interface LorebookCatalogListProps {
  activeLorebookId: string | null;
  lorebooks: readonly LorebookRecord[];
  onCreateLorebook: () => void;
  onOpenLorebook: (lorebookId: string) => void;
}

export function LorebookCatalogList({
  activeLorebookId,
  lorebooks,
  onCreateLorebook,
  onOpenLorebook,
}: LorebookCatalogListProps) {
  return (
    <div className="shoal-list">
      {lorebooks.map((lorebook) => (
        <CatalogRailCard
          key={lorebook.id}
          active={lorebook.id === activeLorebookId}
          initials={getMessengerThreadInitials(lorebook.title)}
          name={lorebook.title}
          sub={lorebook.summary || "No summary yet."}
          tone="amber"
          onOpen={() => onOpenLorebook(lorebook.id)}
        />
      ))}
      {lorebooks.length === 0 && (
        <div className="shoal-empty">
          <p>No lorebooks match this search.</p>
          <button type="button" onClick={onCreateLorebook}>
            ＋ Lorebook
          </button>
        </div>
      )}
    </div>
  );
}
