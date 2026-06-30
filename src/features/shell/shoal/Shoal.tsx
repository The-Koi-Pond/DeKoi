import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { KoiCard } from "./KoiCard";
import { getMessengerThreadActivityAt } from "../../../engine/contracts/types/messenger";
import {
  getRoleplayThreadPreview,
  sortRoleplayThreads,
  sortMessengerThreads,
} from "../../modes";
import type { ShoalSortMode } from "../../../engine/contracts/types/app-settings";
import { sanitizeProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { ROLEPLAY, MESSENGER } from "../../../engine/contracts/constants/surfaces";
import {
  getMessengerCardDetails,
  getRoleplayCardAvatarDetails,
} from "./lib/thread-card-details";
import {
  getCompanionSelectionLabel,
  getDraftCompanionName as getDraftCompanionNameLabel,
  getDraftRoleplayName as getDraftRoleplayNameLabel,
  getLorebookSelectionLabel,
} from "./lib/new-thread-labels";
import { ConnectionsCatalogRail } from "./components/ConnectionsCatalogRail";
import { LorebookCatalogRail } from "./components/LorebookCatalogRail";
import { PeopleCatalogRail } from "./components/PeopleCatalogRail";
import { FolderIcon, RoleplayCardIcon } from "./components/ShoalIcons";
import { ShoalTopBar } from "./components/ShoalTopBar";
import {
  MediaCatalogRail,
  PresetsCatalogRail,
} from "./components/StaticCatalogRails";
import { ChatSettingsRail } from "./components/ChatSettingsRail";
import type { ShoalProps, ShoalRailProps } from "./types";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

type ThreadReleaseRequest = {
  id: string;
  kind: "roleplay" | "messenger";
  title: string;
};

function ThreadShoal({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const [query, setQuery] = useState("");
  const [newMessengerOpen, setNewMessengerOpen] = useState(false);
  const [newMessengerName, setNewMessengerName] = useState("");
  const [newMessengerNameEdited, setNewMessengerNameEdited] = useState(false);
  const [newMessengerConnectionId, setNewMessengerConnectionId] = useState("");
  const [newMessengerPersonaId, setNewMessengerPersonaId] = useState("");
  const [newMessengerCharacterIds, setNewMessengerCharacterIds] = useState<string[]>([]);
  const [newMessengerCompanionMenuOpen, setNewMessengerCompanionMenuOpen] =
    useState(false);
  const [newRoleplayOpen, setNewRoleplayOpen] = useState(false);
  const [newRoleplayName, setNewRoleplayName] = useState("");
  const [newRoleplayNameEdited, setNewRoleplayNameEdited] = useState(false);
  const [newRoleplayConnectionId, setNewRoleplayConnectionId] = useState("");
  const [newRoleplayPersonaId, setNewRoleplayPersonaId] = useState("");
  const [newRoleplayCharacterIds, setNewRoleplayCharacterIds] = useState<string[]>([]);
  const [newRoleplayLorebookIds, setNewRoleplayLorebookIds] = useState<string[]>([]);
  const [newRoleplayCompanionMenuOpen, setNewRoleplayCompanionMenuOpen] =
    useState(false);
  const [newRoleplayLorebookMenuOpen, setNewRoleplayLorebookMenuOpen] =
    useState(false);
  const [releaseRequest, setReleaseRequest] =
    useState<ThreadReleaseRequest | null>(null);
  const sortMode = nav.appSettings.shoalSortMode;
  const nextMessengerThreadNumber = nav.messengerThreads.length + 1;
  const nextRoleplayThreadNumber = nav.roleplayThreads.length + 1;
  const activeSurface = nav.selectedSurface === ROLEPLAY ? ROLEPLAY : MESSENGER;
  const isRoleplaySurface = activeSurface === ROLEPLAY;
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeRoleplayThreadId =
    nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const characterById = useMemo(
    () => new Map(nav.characters.map((character) => [character.id, character])),
    [nav.characters],
  );
  const getDraftCompanionName = (characterIds: string[]) =>
    getDraftCompanionNameLabel(
      characterIds,
      characterById,
      nextMessengerThreadNumber,
    );
  const getDraftRoleplayName = (characterIds: string[]) =>
    getDraftRoleplayNameLabel(
      characterIds,
      characterById,
      nextRoleplayThreadNumber,
    );
  const getCompanionLabel = (characterIds: string[]) =>
    getCompanionSelectionLabel(characterIds, characterById);
  const getLorebookLabel = (lorebookIds: string[]) =>
    getLorebookSelectionLabel(lorebookIds, nav.lorebooks);
  const sanitizedProviderConnections = useMemo(
    () =>
      nav.providerConnections.map((connection) =>
        sanitizeProviderConnectionRecord(connection),
      ),
    [nav.providerConnections],
  );
  const defaultMessengerConnectionId =
    sanitizedProviderConnections.find(
      (connection) => connection.id === nav.appSettings.activeMessengerConnectionId,
    )?.id ??
    sanitizedProviderConnections[0]?.id ??
    "";
  const sortedThreads = useMemo(() => {
    if (sortMode !== "title") {
      return sortMessengerThreads(nav.messengerThreads, sortMode);
    }

    return [...nav.messengerThreads].sort((a, b) => {
      const aDetails = getMessengerCardDetails(a, characterById);
      const bDetails = getMessengerCardDetails(b, characterById);
      return (
        aDetails.name.localeCompare(bDetails.name, undefined, {
          sensitivity: "base",
        }) ||
        getMessengerThreadActivityAt(b).localeCompare(
          getMessengerThreadActivityAt(a),
        )
      );
    });
  }, [characterById, nav.messengerThreads, sortMode]);
  const sortedRoleplayThreads = useMemo(
    () => sortRoleplayThreads(nav.roleplayThreads, sortMode),
    [nav.roleplayThreads, sortMode],
  );
  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedThreads;

    return sortedThreads.filter((thread) => {
      const details = getMessengerCardDetails(thread, characterById);
      return details.searchText.includes(normalizedQuery);
    });
  }, [characterById, query, sortedThreads]);
  const filteredRoleplayThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedRoleplayThreads;

    return sortedRoleplayThreads.filter((thread) => {
      const preview = getRoleplayThreadPreview(thread);
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedRoleplayThreads]);

  useEffect(() => {
    if (!newMessengerOpen && !newRoleplayOpen) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNewMessengerOpen(false);
      setNewRoleplayOpen(false);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [newRoleplayOpen, newMessengerOpen]);

  useEffect(() => {
    if (!releaseRequest) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setReleaseRequest(null);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [releaseRequest]);

  function openNewMessengerThreadPopover() {
    const initialCharacterIds = nav.characters[0] ? [nav.characters[0].id] : [];
    setNewRoleplayOpen(false);
    setNewMessengerCharacterIds(initialCharacterIds);
    setNewMessengerName(getDraftCompanionName(initialCharacterIds));
    setNewMessengerNameEdited(false);
    setNewMessengerConnectionId(defaultMessengerConnectionId);
    setNewMessengerPersonaId("");
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(true);
  }

  function openNewRoleplayThreadPopover() {
    const initialCharacterIds = nav.characters[0] ? [nav.characters[0].id] : [];
    setNewMessengerOpen(false);
    setNewRoleplayCharacterIds(initialCharacterIds);
    setNewRoleplayName(getDraftRoleplayName(initialCharacterIds));
    setNewRoleplayNameEdited(false);
    setNewRoleplayConnectionId(defaultMessengerConnectionId);
    setNewRoleplayPersonaId(nav.personas[0]?.id ?? "");
    setNewRoleplayLorebookIds(nav.lorebooks.map((lorebook) => lorebook.id));
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
    setNewRoleplayOpen(true);
  }

  function updateNewMessengerCharacterIds(characterIds: string[]) {
    setNewMessengerCharacterIds(characterIds);
    if (!newMessengerNameEdited) {
      setNewMessengerName(getDraftCompanionName(characterIds));
    }
  }

  function toggleNewMessengerCharacter(characterId: string) {
    const nextIds = newMessengerCharacterIds.includes(characterId)
      ? newMessengerCharacterIds.filter((id) => id !== characterId)
      : [...newMessengerCharacterIds, characterId];
    updateNewMessengerCharacterIds(nextIds);
  }

  function updateNewRoleplayCharacterIds(characterIds: string[]) {
    setNewRoleplayCharacterIds(characterIds);
    if (!newRoleplayNameEdited) {
      setNewRoleplayName(getDraftRoleplayName(characterIds));
    }
  }

  function toggleNewRoleplayCharacter(characterId: string) {
    const nextIds = newRoleplayCharacterIds.includes(characterId)
      ? newRoleplayCharacterIds.filter((id) => id !== characterId)
      : [...newRoleplayCharacterIds, characterId];
    updateNewRoleplayCharacterIds(nextIds);
  }

  function toggleNewRoleplayLorebook(lorebookId: string) {
    setNewRoleplayLorebookIds((currentIds) =>
      currentIds.includes(lorebookId)
        ? currentIds.filter((id) => id !== lorebookId)
        : [...currentIds, lorebookId],
    );
  }

  function handleCreateMessengerThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newMessengerCharacterIds.length === 0) return;

    const title =
      newMessengerName.trim() ||
      getDraftCompanionName(newMessengerCharacterIds);
    nav.createMessengerThread({
      activePersonaId: newMessengerPersonaId || null,
      characterIds: newMessengerCharacterIds,
      providerConnectionId: newMessengerConnectionId || null,
      title,
    });
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(false);
  }

  function handleCreateRoleplayThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newRoleplayCharacterIds.length === 0) return;

    const title =
      newRoleplayName.trim() ||
      getDraftRoleplayName(newRoleplayCharacterIds);
    nav.createRoleplayThread({
      activePersonaId: newRoleplayPersonaId || null,
      characterIds: newRoleplayCharacterIds,
      lorebookIds: newRoleplayLorebookIds,
      providerConnectionId: newRoleplayConnectionId || null,
      title,
    });
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
    setNewRoleplayOpen(false);
  }

  function handleCreateActiveThread() {
    if (isRoleplaySurface) {
      if (newRoleplayOpen) {
        setNewRoleplayOpen(false);
        return;
      }

      openNewRoleplayThreadPopover();
      return;
    }

    if (newMessengerOpen) {
      setNewMessengerOpen(false);
      return;
    }

    openNewMessengerThreadPopover();
  }

  function handleRenameRoleplay(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Roleplay thread", currentTitle);
    if (nextTitle === null) return;
    nav.renameRoleplayThread(threadId, nextTitle);
  }

  function handleDeleteMessenger(threadId: string, title: string) {
    if (!nav.appSettings.confirmRelease) {
      nav.deleteMessengerThread(threadId);
      return;
    }

    setReleaseRequest({ id: threadId, kind: "messenger", title });
  }

  function handleDeleteRoleplay(threadId: string, title: string) {
    if (!nav.appSettings.confirmRelease) {
      nav.deleteRoleplayThread(threadId);
      return;
    }

    setReleaseRequest({ id: threadId, kind: "roleplay", title });
  }

  function confirmReleaseThread() {
    if (!releaseRequest) return;

    if (releaseRequest.kind === "messenger") {
      nav.deleteMessengerThread(releaseRequest.id);
    } else {
      nav.deleteRoleplayThread(releaseRequest.id);
    }

    setReleaseRequest(null);
  }

  function cycleSortMode() {
    const currentIndex = SHOAL_SORT_ORDER.indexOf(sortMode);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % SHOAL_SORT_ORDER.length;
    nav.setShoalSortMode(SHOAL_SORT_ORDER[nextIndex]);
  }

  const visibleCount = isRoleplaySurface
    ? filteredRoleplayThreads.length
    : filteredThreads.length;
  const activeSurfaceLabel = isRoleplaySurface ? "Roleplay" : "Messenger";
  const searchPlaceholder = isRoleplaySurface
    ? "Find a scene by name or text..."
    : "Find a character by name or message...";

  return (
    <aside className="shoal thread-shoal" aria-label="The Shoal — saved threads">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <div className="shoal-surface-title">{activeSurfaceLabel}</div>
        <div className="shoal-head">
          <div className="shoal-title">
            <button
              className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-cast`}
              type="button"
              aria-controls={
                isRoleplaySurface
                  ? "new-roleplay-thread-popover"
                  : "new-messenger-thread-popover"
              }
              aria-expanded={isRoleplaySurface ? newRoleplayOpen : newMessengerOpen}
              onClick={handleCreateActiveThread}
            >
              {isRoleplaySurface ? "+ New Roleplay" : "+ Cast a Line"}
            </button>
            <button
              className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-folder`}
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
          {isRoleplaySurface
            ? filteredRoleplayThreads.map((thread) => {
                const avatarDetails = getRoleplayCardAvatarDetails(
                  thread.characterIds,
                  thread.title,
                  characterById,
                );

                return (
                  <KoiCard
                    key={thread.id}
                    avatarLabel={avatarDetails.avatarLabel}
                    avatarUrl={avatarDetails.avatarUrl}
                    icon={
                      avatarDetails.hasCharacter ? undefined : <RoleplayCardIcon />
                    }
                    initials={avatarDetails.initials}
                    name={thread.title}
                    sub={getRoleplayThreadPreview(thread)}
                    mode="roleplay"
                    active={thread.id === activeRoleplayThreadId}
                    showStatus={false}
                    onOpen={() => nav.openRoleplayThread(thread.id)}
                    onRename={() => handleRenameRoleplay(thread.id, thread.title)}
                    onDelete={() => handleDeleteRoleplay(thread.id, thread.title)}
                  />
                );
              })
            : filteredThreads.map((thread) => {
                const details = getMessengerCardDetails(thread, characterById);

                return (
                  <KoiCard
                    key={thread.id}
                    avatarLabel={details.name}
                    avatarUrl={details.avatarUrl}
                    initials={details.initials}
                    name={details.name}
                    sub={details.preview}
                    mode="messenger"
                    active={thread.id === activeThreadId}
                    online
                    onOpen={() => nav.openMessengerThread(thread.id)}
                    onDelete={() => handleDeleteMessenger(thread.id, details.name)}
                  />
                );
              })}
          {visibleCount === 0 && (
            <div className="shoal-empty">
              <p>No saved currents match this search.</p>
              <button type="button" onClick={handleCreateActiveThread}>
                {isRoleplaySurface ? "Start roleplay" : "Cast a line"}
              </button>
            </div>
          )}
        </div>
      </div>
      {!isRoleplaySurface && newMessengerOpen && (
        <div
          className="new-thread-backdrop"
          role="presentation"
          onClick={() => setNewMessengerOpen(false)}
        >
          <form
            className="new-thread-popover"
            id="new-messenger-thread-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-messenger-thread-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateMessengerThread}
          >
            <div className="new-thread-popover-head">
              <b id="new-messenger-thread-title">New Messenger Thread</b>
              <button
                type="button"
                aria-label="Close new Messenger thread"
                onClick={() => setNewMessengerOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="new-thread-field">
              <span>Thread Name</span>
              <input
                value={newMessengerName}
                onChange={(event) => {
                  setNewMessengerName(event.target.value);
                  setNewMessengerNameEdited(true);
                }}
                placeholder={getDraftCompanionName(newMessengerCharacterIds)}
              />
            </label>
            <label className="new-thread-field">
              <span>Connection</span>
              <select
                value={newMessengerConnectionId}
                onChange={(event) =>
                  setNewMessengerConnectionId(event.target.value)
                }
                disabled={sanitizedProviderConnections.length === 0}
              >
                {sanitizedProviderConnections.map((connection) => (
                  <option value={connection.id} key={connection.id}>
                    {connection.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="new-thread-field">
              <span>Persona</span>
              <select
                value={newMessengerPersonaId}
                onChange={(event) =>
                  setNewMessengerPersonaId(event.target.value)
                }
              >
                <option value="">Anonymous</option>
                {nav.personas.map((persona) => (
                  <option value={persona.id} key={persona.id}>
                    {persona.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="new-thread-dropdown-field"
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setNewMessengerCompanionMenuOpen(false);
              }}
            >
              <span id="new-thread-companions-label">Companions</span>
              <button
                type="button"
                className="new-thread-select-button"
                aria-controls="new-thread-companion-menu"
                aria-expanded={newMessengerCompanionMenuOpen}
                aria-haspopup="listbox"
                aria-labelledby="new-thread-companions-label"
                disabled={nav.characters.length === 0}
                onClick={() =>
                  setNewMessengerCompanionMenuOpen((open) => !open)
                }
              >
                <span>
                  {getCompanionLabel(newMessengerCharacterIds)}
                </span>
                <small>{newMessengerCharacterIds.length}</small>
              </button>
              {newMessengerCompanionMenuOpen && (
                <div
                  className="new-thread-select-menu"
                  id="new-thread-companion-menu"
                  role="listbox"
                  aria-labelledby="new-thread-companions-label"
                  aria-multiselectable="true"
                >
                  {nav.characters.map((character) => {
                    const selected = newMessengerCharacterIds.includes(
                      character.id,
                    );

                    return (
                      <label
                        className={`new-thread-check${selected ? " on" : ""}`}
                        key={character.id}
                        role="option"
                        aria-selected={selected}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            toggleNewMessengerCharacter(character.id)
                          }
                        />
                        <span>
                          <b>{character.displayName}</b>
                          <small>
                            {character.nickname ||
                              character.personality ||
                              "Companion"}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {nav.characters.length === 0 && (
                <p className="new-thread-empty">
                  Add a companion before casting a Messenger thread.
                </p>
              )}
            </div>
            <div className="new-thread-actions">
              <button type="button" onClick={() => setNewMessengerOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={newMessengerCharacterIds.length === 0}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
      {isRoleplaySurface && newRoleplayOpen && (
        <div
          className="new-thread-backdrop"
          role="presentation"
          onClick={() => setNewRoleplayOpen(false)}
        >
          <form
            className="new-thread-popover"
            id="new-roleplay-thread-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-roleplay-thread-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateRoleplayThread}
          >
            <div className="new-thread-popover-head">
              <b id="new-roleplay-thread-title">New Roleplay Thread</b>
              <button
                type="button"
                aria-label="Close new Roleplay thread"
                onClick={() => setNewRoleplayOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="new-thread-field">
              <span>Thread Name</span>
              <input
                value={newRoleplayName}
                onChange={(event) => {
                  setNewRoleplayName(event.target.value);
                  setNewRoleplayNameEdited(true);
                }}
                placeholder={getDraftRoleplayName(newRoleplayCharacterIds)}
              />
            </label>
            <label className="new-thread-field">
              <span>Connection</span>
              <select
                value={newRoleplayConnectionId}
                onChange={(event) => setNewRoleplayConnectionId(event.target.value)}
                disabled={sanitizedProviderConnections.length === 0}
              >
                {sanitizedProviderConnections.map((connection) => (
                  <option value={connection.id} key={connection.id}>
                    {connection.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="new-thread-field">
              <span>Persona</span>
              <select
                value={newRoleplayPersonaId}
                onChange={(event) => setNewRoleplayPersonaId(event.target.value)}
              >
                <option value="">No persona</option>
                {nav.personas.map((persona) => (
                  <option value={persona.id} key={persona.id}>
                    {persona.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="new-thread-dropdown-field"
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setNewRoleplayCompanionMenuOpen(false);
              }}
            >
              <span id="new-roleplay-companions-label">Companions</span>
              <button
                type="button"
                className="new-thread-select-button"
                aria-controls="new-roleplay-companion-menu"
                aria-expanded={newRoleplayCompanionMenuOpen}
                aria-haspopup="listbox"
                aria-labelledby="new-roleplay-companions-label"
                disabled={nav.characters.length === 0}
                onClick={() => {
                  setNewRoleplayLorebookMenuOpen(false);
                  setNewRoleplayCompanionMenuOpen((open) => !open);
                }}
              >
                <span>
                  {getCompanionLabel(newRoleplayCharacterIds)}
                </span>
                <small>{newRoleplayCharacterIds.length}</small>
              </button>
              {newRoleplayCompanionMenuOpen && (
                <div
                  className="new-thread-select-menu"
                  id="new-roleplay-companion-menu"
                  role="listbox"
                  aria-labelledby="new-roleplay-companions-label"
                  aria-multiselectable="true"
                >
                  {nav.characters.map((character) => {
                    const selected = newRoleplayCharacterIds.includes(character.id);

                    return (
                      <label
                        className={`new-thread-check${selected ? " on" : ""}`}
                        key={character.id}
                        role="option"
                        aria-selected={selected}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleNewRoleplayCharacter(character.id)}
                        />
                        <span>
                          <b>{character.displayName}</b>
                          <small>
                            {character.nickname ||
                              character.personality ||
                              "Companion"}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {nav.characters.length === 0 && (
                <p className="new-thread-empty">
                  Add a companion before starting a Roleplay thread.
                </p>
              )}
            </div>
            <div
              className="new-thread-dropdown-field"
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setNewRoleplayLorebookMenuOpen(false);
              }}
            >
              <span id="new-roleplay-lorebooks-label">Lorebooks</span>
              <button
                type="button"
                className="new-thread-select-button"
                aria-controls="new-roleplay-lorebook-menu"
                aria-expanded={newRoleplayLorebookMenuOpen}
                aria-haspopup="listbox"
                aria-labelledby="new-roleplay-lorebooks-label"
                disabled={nav.lorebooks.length === 0}
                onClick={() => {
                  setNewRoleplayCompanionMenuOpen(false);
                  setNewRoleplayLorebookMenuOpen((open) => !open);
                }}
              >
                <span>
                  {getLorebookLabel(newRoleplayLorebookIds)}
                </span>
                <small>{newRoleplayLorebookIds.length}</small>
              </button>
              {newRoleplayLorebookMenuOpen && (
                <div
                  className="new-thread-select-menu"
                  id="new-roleplay-lorebook-menu"
                  role="listbox"
                  aria-labelledby="new-roleplay-lorebooks-label"
                  aria-multiselectable="true"
                >
                  {nav.lorebooks.map((lorebook) => {
                    const selected = newRoleplayLorebookIds.includes(lorebook.id);

                    return (
                      <label
                        className={`new-thread-check${selected ? " on" : ""}`}
                        key={lorebook.id}
                        role="option"
                        aria-selected={selected}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleNewRoleplayLorebook(lorebook.id)}
                        />
                        <span>
                          <b>{lorebook.title}</b>
                          <small>{lorebook.summary || "Lorebook"}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="new-thread-actions">
              <button type="button" onClick={() => setNewRoleplayOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={newRoleplayCharacterIds.length === 0}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
      {releaseRequest && (
        <div
          className="release-dialog-backdrop"
          role="presentation"
          onClick={() => setReleaseRequest(null)}
        >
          <section
            className="release-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-thread-title"
            aria-describedby="release-thread-copy"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="release-dialog-icon" aria-hidden="true">
              ×
            </div>
            <div className="release-dialog-copy">
              <h2 id="release-thread-title">
                Release {releaseRequest.kind === "roleplay" ? "scene" : "thread"}?
              </h2>
              <p id="release-thread-copy">
                <b>{releaseRequest.title}</b> will be removed from the Shoal.
              </p>
            </div>
            <div className="release-dialog-actions">
              <button type="button" onClick={() => setReleaseRequest(null)}>
                Cancel
              </button>
              <button type="button" onClick={confirmReleaseThread}>
                Release
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

export function Shoal({ nav, onToggleShoal, shoalClosed }: ShoalProps) {
  const [chatSettingsState, setChatSettingsState] = useState({
    open: false,
    sideRailView: nav.sideRailView,
  });

  if (chatSettingsState.sideRailView !== nav.sideRailView) {
    setChatSettingsState({ open: false, sideRailView: nav.sideRailView });
  }

  const chatSettingsOpen =
    chatSettingsState.sideRailView === nav.sideRailView && chatSettingsState.open;
  const railProps = {
    chatSettingsOpen,
    nav,
    onCloseChatSettings: () =>
      setChatSettingsState({ open: false, sideRailView: nav.sideRailView }),
    onOpenChatSettings: () =>
      setChatSettingsState({ open: true, sideRailView: nav.sideRailView }),
    onToggleShoal,
    shoalClosed,
  };

  if (chatSettingsOpen) {
    return <ChatSettingsRail {...railProps} />;
  }

  if (nav.sideRailView === "lorebooks") {
    return <LorebookCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "people") {
    return <PeopleCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "media") {
    return <MediaCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "presets") {
    return <PresetsCatalogRail {...railProps} />;
  }
  if (nav.sideRailView === "connections") {
    return <ConnectionsCatalogRail {...railProps} />;
  }

  return <ThreadShoal {...railProps} />;
}
