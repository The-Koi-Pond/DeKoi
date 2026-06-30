import { useMemo, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";
import { FolderIcon } from "./ShoalIcons";
import { ShoalTopBar } from "./ShoalTopBar";

type PeopleTab = "companions" | "personas";

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
  const [activeTab, setActiveTab] = useState<PeopleTab>("companions");
  const normalizedQuery = query.trim().toLowerCase();
  const activeCharacterId =
    nav.view.kind === "companions" ? nav.view.characterId : null;
  const activePersonaId = nav.view.kind === "personas" ? nav.view.personaId : null;
  const filteredCharacters = useMemo(() => {
    if (!normalizedQuery) return nav.characters;

    return nav.characters.filter((character) =>
      [
        character.displayName,
        character.nickname ?? "",
        character.personality,
        character.description,
        character.scenario,
        character.creator,
        character.creatorNotes,
        character.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.characters, normalizedQuery]);
  const filteredPersonas = useMemo(() => {
    if (!normalizedQuery) return nav.personas;

    return nav.personas.filter((persona) =>
      [
        persona.displayName,
        persona.nickname ?? "",
        persona.personality,
        persona.description,
        persona.scenario,
        persona.creator,
        persona.creatorNotes,
        persona.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.personas, normalizedQuery]);
  const isCompanionTab = activeTab === "companions";
  const shownCount = isCompanionTab
    ? filteredCharacters.length
    : filteredPersonas.length;
  const actionTone = isCompanionTab ? "koi" : "roleplay";
  const searchKind = isCompanionTab ? "companions" : "personas";

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
        <div className="shoal-head">
          <div
            className="catalog-rail-tabs"
            role="tablist"
            aria-label="Character catalog"
          >
            <button
              type="button"
              className={isCompanionTab ? "on" : ""}
              role="tab"
              aria-selected={isCompanionTab}
              onClick={() => setActiveTab("companions")}
            >
              Companions
            </button>
            <button
              type="button"
              className={!isCompanionTab ? "on" : ""}
              role="tab"
              aria-selected={!isCompanionTab}
              onClick={() => setActiveTab("personas")}
            >
              Personas
            </button>
          </div>
          <div className="shoal-search">
            <label
              className="glyph"
              aria-hidden="true"
              htmlFor="catalog-people-search-input"
            >
              ⌕
            </label>
            <input
              id="catalog-people-search-input"
              type="search"
              aria-label={`Find ${searchKind}`}
              placeholder={`Find ${searchKind}...`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="shoal-actions">
            <button className={`pill ${actionTone}`} type="button" onClick={openNew}>
              ＋ {isCompanionTab ? "Companion" : "Persona"}
            </button>
            <button
              className={`pill ${actionTone} title-folder`}
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
          {isCompanionTab ? (
            <>
              <div className="group-label people-label">
                <span>Companions</span>
                <span className="count-bubble">{nav.characters.length}</span>
              </div>
              {filteredCharacters.map((character) => (
                <CatalogRailCard
                  key={character.id}
                  active={character.id === activeCharacterId}
                  avatarUrl={character.avatarUrl}
                  initials={getMessengerThreadInitials(character.displayName)}
                  name={character.displayName}
                  sub={character.personality || character.nickname || "No personality yet."}
                  tone="koi"
                  onOpen={() =>
                    nav.setView({ kind: "companions", characterId: character.id })
                  }
                />
              ))}
            </>
          ) : (
            <>
              <div className="group-label people-label">
                <span>Personas</span>
                <span className="count-bubble">{nav.personas.length}</span>
              </div>
              {filteredPersonas.map((persona) => (
                <CatalogRailCard
                  key={persona.id}
                  active={persona.id === activePersonaId}
                  avatarUrl={persona.avatarUrl}
                  initials={getMessengerThreadInitials(persona.displayName)}
                  name={persona.displayName}
                  sub={persona.personality || persona.nickname || "No personality yet."}
                  tone="jade"
                  onOpen={() => nav.setView({ kind: "personas", personaId: persona.id })}
                />
              ))}
            </>
          )}
          {shownCount === 0 && (
            <div className="shoal-empty">
              <p>No catalog records match this search.</p>
              <button type="button" onClick={openNew}>
                ＋ {isCompanionTab ? "Companion" : "Persona"}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
