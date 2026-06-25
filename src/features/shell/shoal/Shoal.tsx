import { useMemo, useState } from "react";
import { KoiCard } from "./KoiCard";
import {
  getClassicThreadInitials,
  getClassicThreadPreview,
  sortClassicThreads,
} from "../../modes/classic/classic-display";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreads,
} from "../../modes/messenger/thread-display";
import { useNav } from "../../navigation/nav-context";
import type { ShoalSortMode } from "../../../runtime/app-settings";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

type PeopleTab = "companions" | "personas";

interface CatalogRailCardProps {
  active?: boolean;
  badge: string;
  initials: string;
  name: string;
  onOpen: () => void;
  sub: string;
  tone: "koi" | "jade" | "amber";
}

function CatalogRailCard({
  active,
  badge,
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
      <span className="catalog-rail-badge">{badge}</span>
    </button>
  );
}

function PeopleCatalogRail() {
  const nav = useNav();
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

  function openNew() {
    if (isCompanionTab) {
      nav.setView({ kind: "companions", mode: "new" });
      return;
    }

    nav.setView({ kind: "personas", mode: "new" });
  }

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — characters">
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <span className="shoal-symbol" aria-hidden="true">
              ⚇
            </span>
            Catalog
          </h2>
          <span className="count">
            {nav.characters.length + nav.personas.length} stocked
          </span>
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
            placeholder="Find companions or personas..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
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
            Companions <span>{nav.characters.length}</span>
          </button>
          <button
            type="button"
            className={!isCompanionTab ? "on" : ""}
            role="tab"
            aria-selected={!isCompanionTab}
            onClick={() => setActiveTab("personas")}
          >
            Personas <span>{nav.personas.length}</span>
          </button>
        </div>
        <div className="shoal-actions">
          <button className="pill koi" type="button" onClick={openNew}>
            ＋ {isCompanionTab ? "Companion" : "Persona"}
          </button>
        </div>
      </div>
      <div className="shoal-meta">
        <span>{isCompanionTab ? "Companions" : "Personas"}</span>
        <span className="mark-chip">{shownCount} shown</span>
      </div>
      <div className="shoal-list">
        {isCompanionTab ? (
          <>
            <div className="group-label">Companions</div>
            {filteredCharacters.map((character) => (
              <CatalogRailCard
                key={character.id}
                active={character.id === activeCharacterId}
                badge="Companion"
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
            <div className="group-label">Personas</div>
            {filteredPersonas.map((persona) => (
              <CatalogRailCard
                key={persona.id}
                active={persona.id === activePersonaId}
                badge="Persona"
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

function LorebookCatalogRail() {
  const nav = useNav();
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
        </div>
      </div>
      <div className="shoal-meta">
        <span>Lorebooks</span>
        <span className="mark-chip">{filteredLorebooks.length} shown</span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Lorebooks</div>
        {filteredLorebooks.map((lorebook) => (
          <CatalogRailCard
            key={lorebook.id}
            active={lorebook.id === activeLorebookId}
            badge={`${lorebook.entries.length} notes`}
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

function ThreadShoal() {
  const nav = useNav();
  const [query, setQuery] = useState("");
  const sortMode = nav.appSettings.shoalSortMode;
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
  const totalThreads = sortedThreads.length + sortedClassicThreads.length;
  const storageLabel =
    nav.messengerStorageMode === "remote" && nav.messengerStorageStatus !== "error"
      ? "remote runtime"
      : nav.messengerStorageMode === "desktop" && nav.messengerStorageStatus !== "error"
        ? "desktop host"
        : "storage unavailable";
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

  return (
    <aside className="shoal" aria-label="The Shoal — saved threads">
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <img className="shoal-mark" src="/koi-mark.svg" alt="" />
            The Shoal
          </h2>
          <span className="count">{totalThreads} swimming</span>
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
            placeholder="Find a koi by name or marking…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="shoal-actions">
          <button
            className="pill koi"
            onClick={() => nav.createMessengerThread()}
          >
            ＋ Cast a line
          </button>
          <button className="pill" onClick={() => nav.createClassicThread()}>
            ＋ Scene
          </button>
          <button className="pill" disabled title="Not stocked yet">
            ⬡ Net
          </button>
          <button className="pill" disabled title="Not stocked yet">
            ◇ Catch
          </button>
        </div>
      </div>
      <div className="shoal-meta">
        <button
          type="button"
          className="sort"
          aria-label={`Sort Messenger threads: ${SHOAL_SORT_LABELS[sortMode]}`}
          title="Change thread sort"
          onClick={cycleSortMode}
        >
          ↕ {SHOAL_SORT_LABELS[sortMode]}
        </button>
        <span className="mark-chip" title={nav.messengerStorageMessage}>
          ⌗ {filteredThreads.length + filteredClassicThreads.length} shown
        </span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Messenger — {storageLabel}</div>
        {filteredThreads.map((thread) => (
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
        <div className="group-label">Classic — {storageLabel}</div>
        {filteredClassicThreads.map((thread) => (
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
        ))}
        {filteredThreads.length === 0 && filteredClassicThreads.length === 0 && (
          <div className="shoal-empty">
            <p>No saved currents match this search.</p>
            <button type="button" onClick={() => nav.createMessengerThread()}>
              Cast a line
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Shoal() {
  const nav = useNav();

  if (nav.sideRailView === "lorebooks") return <LorebookCatalogRail />;
  if (nav.sideRailView === "people") return <PeopleCatalogRail />;

  return <ThreadShoal />;
}
