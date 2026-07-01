import {
  useLorebookCatalogRailController,
  type LorebookCatalogRailNav,
} from "../hooks/use-lorebook-catalog-rail-controller";
import { LorebookCatalogHead } from "./LorebookCatalogHead";
import { LorebookCatalogList } from "./LorebookCatalogList";
import { ShoalTopBar } from "./ShoalTopBar";

interface LorebookCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: LorebookCatalogRailNav;
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function LorebookCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: LorebookCatalogRailProps) {
  const {
    activeLorebookId,
    entryCount,
    filteredLorebooks,
    query,
    openLorebook,
    openNewLorebook,
    setQuery,
  } = useLorebookCatalogRailController({ nav });

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — lorebooks">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <LorebookCatalogHead
          entryCount={entryCount}
          query={query}
          onCreateLorebook={openNewLorebook}
          onQueryChange={setQuery}
        />
        <LorebookCatalogList
          activeLorebookId={activeLorebookId}
          lorebooks={filteredLorebooks}
          onCreateLorebook={openNewLorebook}
          onOpenLorebook={openLorebook}
        />
      </div>
    </aside>
  );
}
