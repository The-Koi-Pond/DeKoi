import { useMemo, useState } from "react";
import { KoiCard } from "./KoiCard";
import {
  getClassicThreadInitials,
  getClassicThreadPreview,
  sortClassicThreads,
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreads,
} from "../../modes";
import type {
  NavCatalogState,
  NavClassicThreadActions,
  NavMessengerThreadActions,
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { ShoalSortMode } from "../../../engine/app-settings";
import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
} from "../../../engine/provider-connection";
import { CLASSIC, MESSENGER } from "../../../engine/surfaces";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

type PeopleTab = "companions" | "personas";

interface ShoalProps {
  nav: ShoalNav;
  onCollapse: () => void;
}

export type ShoalNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<
    NavClassicThreadActions,
    "createClassicThread" | "deleteClassicThread" | "renameClassicThread"
  > &
  Pick<
    NavMessengerThreadActions,
    "createMessengerThread" | "deleteMessengerThread" | "renameMessengerThread"
  > &
  Pick<NavSettingsActions, "setShoalSortMode"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "classicThreads" | "messengerThreads"> &
  Pick<NavViewActions, "openClassicThread" | "openMessengerThread" | "setView"> &
  Pick<NavViewState, "selectedSurface" | "sideRailView" | "view">;

interface CatalogRailCardProps {
  active?: boolean;
  initials: string;
  name: string;
  onOpen: () => void;
  sub: string;
  tone: "koi" | "jade" | "amber";
}

function ShoalTopBar({ onCollapse }: Pick<ShoalProps, "onCollapse">) {
  return (
    <div className="shoal-topbar">
      <span>The Shoal</span>
      <button
        type="button"
        aria-label="Collapse The Shoal"
        title="Collapse The Shoal"
        onClick={onCollapse}
      >
        ‹
      </button>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M2.5 5.5h5l1.3 1.7h6.7v6.2a1.1 1.1 0 0 1-1.1 1.1H3.6a1.1 1.1 0 0 1-1.1-1.1z" />
      <path d="M2.5 5.5V4.6a1.1 1.1 0 0 1 1.1-1.1h3.1l1.2 2" />
    </svg>
  );
}

function CatalogRailCard({
  active,
  initials,
  name,
  onOpen,
  sub,
  tone,
}: CatalogRailCardProps) {
  return (
    <button
      type="button"
      className={`catalog-rail-card ${tone}${active ? " on" : ""}`}
      onClick={onOpen}
    >
      <span className="catalog-rail-ava">{initials}</span>
      <span className="catalog-rail-copy">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}

function PeopleCatalogRail({ nav, onCollapse }: ShoalProps) {
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
        character.shortName ?? "",
        character.summary,
        character.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.characters, normalizedQuery]);
  const filteredPersonas = useMemo(() => {
    if (!normalizedQuery) return nav.personas;

    return nav.personas.filter((persona) =>
      [persona.displayName, persona.summary, persona.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.personas, normalizedQuery]);
  const isCompanionTab = activeTab === "companions";
  const shownCount = isCompanionTab
    ? filteredCharacters.length
    : filteredPersonas.length;
  const actionTone = isCompanionTab ? "koi" : "classic";
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
      <ShoalTopBar onCollapse={onCollapse} />
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
                initials={getMessengerThreadInitials(character.displayName)}
                name={character.displayName}
                sub={character.summary || character.shortName || "No summary yet."}
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
                initials={getMessengerThreadInitials(persona.displayName)}
                name={persona.displayName}
                sub={persona.summary || "No summary yet."}
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
    </aside>
  );
}

function LorebookCatalogRail({ nav, onCollapse }: ShoalProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const activeLorebookId =
    nav.view.kind === "lorebooks" ? nav.view.lorebookId : null;
  const filteredLorebooks = useMemo(() => {
    if (!normalizedQuery) return nav.lorebooks;

    return nav.lorebooks.filter((lorebook) =>
      [
        lorebook.title,
        lorebook.summary,
        ...lorebook.entries.flatMap((entry) => [entry.title, entry.body]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.lorebooks, normalizedQuery]);
  const entryCount = nav.lorebooks.reduce(
    (count, lorebook) => count + lorebook.entries.length,
    0,
  );

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — lorebooks">
      <ShoalTopBar onCollapse={onCollapse} />
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <span className="shoal-symbol" aria-hidden="true">
              ▤
            </span>
            Lorebooks
          </h2>
          <span className="count">{entryCount} entries</span>
        </div>
        <div className="shoal-search">
          <label
            className="glyph"
            aria-hidden="true"
            htmlFor="catalog-lorebook-search-input"
          >
            ⌕
          </label>
          <input
            id="catalog-lorebook-search-input"
            type="search"
            placeholder="Find lorebooks or entries..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="shoal-actions">
          <button
            className="pill koi"
            type="button"
            onClick={() => nav.setView({ kind: "lorebooks", mode: "new-lorebook" })}
          >
            ＋ Lorebook
          </button>
          <button
            className="pill amber title-folder"
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
        {filteredLorebooks.map((lorebook) => (
          <CatalogRailCard
            key={lorebook.id}
            active={lorebook.id === activeLorebookId}
            initials={getMessengerThreadInitials(lorebook.title)}
            name={lorebook.title}
            sub={lorebook.summary || "No summary yet."}
            tone="amber"
            onOpen={() => nav.setView({ kind: "lorebooks", lorebookId: lorebook.id })}
          />
        ))}
        {filteredLorebooks.length === 0 && (
          <div className="shoal-empty">
            <p>No lorebooks match this search.</p>
            <button
              type="button"
              onClick={() => nav.setView({ kind: "lorebooks", mode: "new-lorebook" })}
            >
              ＋ Lorebook
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function ConnectionsCatalogRail({ nav, onCollapse }: ShoalProps) {
  const activeConnectionId =
    nav.view.kind === "connections" ? nav.view.connectionId : null;

  function openNewConnection() {
    nav.setView({ kind: "connections", mode: "new" });
  }

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — connections">
      <ShoalTopBar onCollapse={onCollapse} />
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
    </aside>
  );
}

function MediaCatalogRail({ onCollapse }: Pick<ShoalProps, "onCollapse">) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — media">
      <ShoalTopBar onCollapse={onCollapse} />
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <span className="shoal-symbol" aria-hidden="true">
              ◐
            </span>
            Media
          </h2>
        </div>
      </div>
      <div className="shoal-meta">
        <span>Assets</span>
      </div>
      <div className="shoal-list">
        <div className="shoal-empty">
          <p>No media assets yet.</p>
        </div>
      </div>
    </aside>
  );
}

function PresetsCatalogRail({ onCollapse }: Pick<ShoalProps, "onCollapse">) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — presets">
      <ShoalTopBar onCollapse={onCollapse} />
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <span className="shoal-symbol" aria-hidden="true">
              ≡
            </span>
            Presets
          </h2>
          <span className="count">0 stocked</span>
        </div>
      </div>
      <div className="shoal-meta">
        <span>Presets</span>
        <span className="mark-chip">0 shown</span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Presets</div>
        <div className="shoal-empty">
          <p>No presets yet.</p>
        </div>
      </div>
    </aside>
  );
}

function ThreadShoal({ nav, onCollapse }: ShoalProps) {
  const [query, setQuery] = useState("");
  const sortMode = nav.appSettings.shoalSortMode;
  const activeSurface = nav.selectedSurface === CLASSIC ? CLASSIC : MESSENGER;
  const isClassicSurface = activeSurface === CLASSIC;
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeClassicThreadId =
    nav.view.kind === "classic" ? nav.view.threadId : null;
  const sortedThreads = useMemo(
    () => sortMessengerThreads(nav.messengerThreads, sortMode),
    [nav.messengerThreads, sortMode],
  );
  const sortedClassicThreads = useMemo(
    () => sortClassicThreads(nav.classicThreads, sortMode),
    [nav.classicThreads, sortMode],
  );
  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedThreads;

    return sortedThreads.filter((thread) => {
      const preview = getMessengerThreadPreview(thread);
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedThreads]);
  const filteredClassicThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedClassicThreads;

    return sortedClassicThreads.filter((thread) => {
      const preview = getClassicThreadPreview(thread);
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedClassicThreads]);

  function handleRenameMessenger(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Messenger thread", currentTitle);
    if (nextTitle === null) return;
    nav.renameMessengerThread(threadId, nextTitle);
  }

  function handleRenameClassic(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Classic scene", currentTitle);
    if (nextTitle === null) return;
    nav.renameClassicThread(threadId, nextTitle);
  }

  function handleDeleteMessenger(threadId: string, title: string) {
    if (
      nav.appSettings.confirmRelease &&
      !window.confirm(`Release "${title}" from the Shoal?`)
    ) {
      return;
    }

    nav.deleteMessengerThread(threadId);
  }

  function handleDeleteClassic(threadId: string, title: string) {
    if (
      nav.appSettings.confirmRelease &&
      !window.confirm(`Release "${title}" from the Shoal?`)
    ) {
      return;
    }

    nav.deleteClassicThread(threadId);
  }

  function cycleSortMode() {
    const currentIndex = SHOAL_SORT_ORDER.indexOf(sortMode);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % SHOAL_SORT_ORDER.length;
    nav.setShoalSortMode(SHOAL_SORT_ORDER[nextIndex]);
  }

  const visibleCount = isClassicSurface
    ? filteredClassicThreads.length
    : filteredThreads.length;
  const activeSurfaceLabel = isClassicSurface ? "Classic" : "Messenger";
  const searchPlaceholder = isClassicSurface
    ? "Find a scene by name or text..."
    : "Find a koi by name or marking...";
  const createActiveThread = isClassicSurface
    ? nav.createClassicThread
    : nav.createMessengerThread;

  return (
    <aside className="shoal thread-shoal" aria-label="The Shoal — saved threads">
      <ShoalTopBar onCollapse={onCollapse} />
      <div className="shoal-surface-title">{activeSurfaceLabel}</div>
      <div className="shoal-head">
        <div className="shoal-title">
          <button
            className={`pill ${isClassicSurface ? "classic" : "koi"} title-cast`}
            type="button"
            onClick={() => createActiveThread()}
          >
            {isClassicSurface ? "+ New Scene" : "+ Cast a Line"}
          </button>
          <button
            className={`pill ${isClassicSurface ? "classic" : "koi"} title-folder`}
            type="button"
            title="Add grouping folder"
            aria-label="Add grouping folder"
            disabled
          >
            <FolderIcon />
            Folder
          </button>
        </div>
        <div className="shoal-search">
          <label
            className="glyph"
            aria-hidden="true"
            htmlFor="shoal-search-input"
          >
            ⌕
          </label>
          <input
            id="shoal-search-input"
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="shoal-meta">
        <button
          type="button"
          className="sort"
          aria-label={`Sort ${activeSurfaceLabel} threads: ${SHOAL_SORT_LABELS[sortMode]}`}
          title="Change thread sort"
          onClick={cycleSortMode}
        >
          ↕ {SHOAL_SORT_LABELS[sortMode]}
        </button>
      </div>
      <div className="shoal-list">
        {isClassicSurface
          ? filteredClassicThreads.map((thread) => (
              <KoiCard
                key={thread.id}
                initials={getClassicThreadInitials(thread.title)}
                name={thread.title}
                sub={getClassicThreadPreview(thread)}
                mode="classic"
                active={thread.id === activeClassicThreadId}
                online
                onOpen={() => nav.openClassicThread(thread.id)}
                onRename={() => handleRenameClassic(thread.id, thread.title)}
                onDelete={() => handleDeleteClassic(thread.id, thread.title)}
              />
            ))
          : filteredThreads.map((thread) => (
              <KoiCard
                key={thread.id}
                initials={getMessengerThreadInitials(thread.title)}
                name={thread.title}
                sub={getMessengerThreadPreview(thread)}
                mode="messenger"
                active={thread.id === activeThreadId}
                online
                onOpen={() => nav.openMessengerThread(thread.id)}
                onRename={() => handleRenameMessenger(thread.id, thread.title)}
                onDelete={() => handleDeleteMessenger(thread.id, thread.title)}
              />
            ))}
        {visibleCount === 0 && (
          <div className="shoal-empty">
            <p>No saved currents match this search.</p>
            <button type="button" onClick={() => createActiveThread()}>
              {isClassicSurface ? "Start scene" : "Cast a line"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Shoal({ nav, onCollapse }: ShoalProps) {
  if (nav.sideRailView === "lorebooks") {
    return <LorebookCatalogRail nav={nav} onCollapse={onCollapse} />;
  }
  if (nav.sideRailView === "people") {
    return <PeopleCatalogRail nav={nav} onCollapse={onCollapse} />;
  }
  if (nav.sideRailView === "media") {
    return <MediaCatalogRail onCollapse={onCollapse} />;
  }
  if (nav.sideRailView === "presets") {
    return <PresetsCatalogRail onCollapse={onCollapse} />;
  }
  if (nav.sideRailView === "connections") {
    return <ConnectionsCatalogRail nav={nav} onCollapse={onCollapse} />;
  }

  return <ThreadShoal nav={nav} onCollapse={onCollapse} />;
}
