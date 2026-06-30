import { useMemo, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import {
  filterPeopleCatalogCharacters,
  filterPeopleCatalogPersonas,
  type PeopleCatalogTab,
} from "../lib/people-catalog-view-model";
import { PeopleCatalogHead } from "./PeopleCatalogHead";
import { PeopleCatalogList } from "./PeopleCatalogList";
import { ShoalTopBar } from "./ShoalTopBar";

interface PeopleCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: {
    characters: CharacterRecord[];
    personas: PersonaRecord[];
    selectedSurface: string;
    setView: (
      view:
        | { kind: "companions"; characterId: string }
        | { kind: "companions"; mode: "new" }
        | { kind: "personas"; personaId: string }
        | { kind: "personas"; mode: "new" },
    ) => void;
    view: {
      characterId?: string;
      kind: string;
      personaId?: string;
    };
  };
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
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PeopleCatalogTab>("companions");
  const normalizedQuery = query.trim().toLowerCase();
  const activeCharacterId =
    nav.view.kind === "companions" ? nav.view.characterId ?? null : null;
  const activePersonaId =
    nav.view.kind === "personas" ? nav.view.personaId ?? null : null;
  const filteredCharacters = useMemo(
    () => filterPeopleCatalogCharacters(nav.characters, normalizedQuery),
    [nav.characters, normalizedQuery],
  );
  const filteredPersonas = useMemo(
    () => filterPeopleCatalogPersonas(nav.personas, normalizedQuery),
    [nav.personas, normalizedQuery],
  );
  const isCompanionTab = activeTab === "companions";

  function openNew() {
    if (isCompanionTab) {
      nav.setView({ kind: "companions", mode: "new" });
      return;
    }

    nav.setView({ kind: "personas", mode: "new" });
  }

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
          onOpenCharacter={(characterId) =>
            nav.setView({ kind: "companions", characterId })
          }
          onOpenPersona={(personaId) => nav.setView({ kind: "personas", personaId })}
        />
      </div>
    </aside>
  );
}
