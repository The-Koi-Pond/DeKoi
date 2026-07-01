import {
  usePeopleCatalogRailController,
  type PeopleCatalogRailNav,
} from "../hooks/use-people-catalog-rail-controller";
import { PeopleCatalogHead } from "./PeopleCatalogHead";
import { PeopleCatalogList } from "./PeopleCatalogList";
import { ShoalTopBar } from "./ShoalTopBar";

interface PeopleCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: PeopleCatalogRailNav;
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function PeopleCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: PeopleCatalogRailProps) {
  const {
    activeCharacterId,
    activePersonaId,
    activeTab,
    filteredCharacters,
    filteredPersonas,
    query,
    openCharacter,
    openNew,
    openPersona,
    setActiveTab,
    setQuery,
  } = usePeopleCatalogRailController({ nav });

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — characters">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <PeopleCatalogHead
          activeTab={activeTab}
          query={query}
          onActiveTabChange={setActiveTab}
          onCreate={openNew}
          onQueryChange={setQuery}
        />
        <PeopleCatalogList
          activeCharacterId={activeCharacterId}
          activePersonaId={activePersonaId}
          activeTab={activeTab}
          characters={nav.characters}
          filteredCharacters={filteredCharacters}
          filteredPersonas={filteredPersonas}
          personas={nav.personas}
          onCreate={openNew}
          onOpenCharacter={openCharacter}
          onOpenPersona={openPersona}
        />
      </div>
    </aside>
  );
}
