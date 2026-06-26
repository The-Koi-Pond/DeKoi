import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { KoiCard } from "./KoiCard";
import { NumberField } from "../../../shared/ui/primitives/NumberField";
import { Slider } from "../../../shared/ui/primitives/Slider";
import {
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadProviderConnection,
  setMessengerThreadSystemPrompt,
} from "../../../engine/messenger-actions";
import {
  getRoleplayThreadPreview,
  sortRoleplayThreads,
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreads,
} from "../../modes";
import type {
  NavCatalogState,
  NavRoleplayThreadActions,
  NavMessengerThreadActions,
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { CharacterRecord } from "../../../engine/character";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from "../../../engine/messenger";
import type { ShoalSortMode } from "../../../engine/app-settings";
import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
} from "../../../engine/provider-connection";
import { ROLEPLAY, MESSENGER } from "../../../engine/surfaces";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

type PeopleTab = "companions" | "personas";
type ChatSettingsDrawerId =
  | "connection"
  | "persona"
  | "companions"
  | "prompt"
  | "lorebooks"
  | "advanced";
const CHAT_SETTINGS_DRAWER_DEFAULTS: Record<ChatSettingsDrawerId, boolean> = {
  connection: true,
  persona: false,
  companions: false,
  prompt: false,
  lorebooks: false,
  advanced: false,
};

type ThreadReleaseRequest = {
  id: string;
  kind: "roleplay" | "messenger";
  title: string;
};

interface ShoalProps {
  nav: ShoalNav;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

interface ShoalRailProps extends ShoalProps {
  chatSettingsOpen: boolean;
  onCloseChatSettings: () => void;
  onOpenChatSettings: () => void;
}

type ShoalTopBarProps = Pick<
  ShoalRailProps,
  | "chatSettingsOpen"
  | "nav"
  | "onOpenChatSettings"
  | "onToggleShoal"
  | "shoalClosed"
>;

export type ShoalNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<
    NavRoleplayThreadActions,
    "createRoleplayThread" | "deleteRoleplayThread" | "renameRoleplayThread"
  > &
  Pick<
    NavMessengerThreadActions,
    | "createMessengerThread"
    | "deleteMessengerThread"
    | "renameMessengerThread"
    | "updateMessengerThread"
  > &
  Pick<
    NavSettingsActions,
    "setActiveMessengerConnectionId" | "setShoalSortMode" | "updateAppSettings"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "roleplayThreads" | "messengerThreads"> &
  Pick<NavViewActions, "openRoleplayThread" | "openMessengerThread" | "setView"> &
  Pick<NavViewState, "selectedSurface" | "sideRailView" | "view">;

interface CatalogRailCardProps {
  active?: boolean;
  avatarUrl?: string | null;
  initials: string;
  name: string;
  onOpen: () => void;
  sub: string;
  tone: "koi" | "jade" | "amber";
}

function ShoalTopBar({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalTopBarProps) {
  const chatSettingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";

  return (
    <div className="shoal-topbar">
      <button
        type="button"
        className="shoal-toggle"
        aria-label={shoalClosed ? "Open The Shoal" : "Collapse The Shoal"}
        aria-expanded={!shoalClosed}
        title={shoalClosed ? "Open The Shoal" : "Collapse The Shoal"}
        onClick={onToggleShoal}
      >
        {shoalClosed ? "›" : "‹"}
      </button>
      <span>The Shoal</span>
      <button
        type="button"
        className={`shoal-settings-button${chatSettingsOpen ? " on" : ""}`}
        title={chatSettingsLabel}
        aria-label={chatSettingsLabel}
        aria-pressed={chatSettingsOpen}
        onClick={onOpenChatSettings}
      >
        <span aria-hidden="true">⚙</span>
        <span>{chatSettingsLabel}</span>
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

function RoleplayCardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5.5h5.7c1.2 0 2.3.5 3.1 1.3v11.7c-.8-.8-1.9-1.3-3.1-1.3H5z" />
      <path d="M13.8 6.8c.8-.8 1.9-1.3 3.1-1.3H19v11.7h-2.1c-1.2 0-2.3.5-3.1 1.3" />
      <path d="M7.6 9h3.2" />
      <path d="M16.2 9h1.1" />
    </svg>
  );
}

function CatalogRailCard({
  active,
  avatarUrl,
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
      <span className="catalog-rail-ava">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
      </span>
      <span className="catalog-rail-copy">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}

function getMessengerCardDetails(
  thread: MessengerThread,
  characterById: Map<string, CharacterRecord>,
) {
  const companions = thread.characterIds.flatMap((characterId) => {
    const companion = characterById.get(characterId);
    return companion ? [companion] : [];
  });
  const missingCount = thread.characterIds.length - companions.length;
  const name =
    companions.map((companion) => companion.displayName).join(" + ") ||
    (missingCount > 0 ? "Missing companion" : "No companion");
  const threadTitle = thread.title.trim();
  const displayName =
    threadTitle && !/^New Messenger \d+$/i.test(threadTitle) ? threadTitle : name;
  const preview = getMessengerThreadPreview(thread);
  const searchText = [
    displayName,
    name,
    threadTitle,
    preview,
    ...companions.flatMap((companion) => [
      companion.nickname ?? "",
      companion.personality,
      companion.description,
      companion.scenario,
      companion.tags.join(" "),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return {
    avatarUrl: companions[0]?.avatarUrl ?? null,
    initials: getMessengerThreadInitials(name),
    name: displayName,
    preview,
    searchText,
  };
}

function getRoleplayCardAvatarDetails(
  characterIds: string[],
  fallbackName: string,
  characterById: Map<string, CharacterRecord>,
) {
  const companion =
    characterIds
      .map((characterId) => characterById.get(characterId) ?? null)
      .find((candidate): candidate is CharacterRecord => candidate !== null) ??
    null;
  const avatarLabel = companion?.displayName ?? fallbackName;

  return {
    avatarLabel,
    avatarUrl: companion?.avatarUrl ?? null,
    hasCharacter: companion !== null,
    initials: getMessengerThreadInitials(avatarLabel),
  };
}

function PeopleCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
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

function LorebookCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
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
      </div>
    </aside>
  );
}

function ConnectionsCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
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

function MediaCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — media">
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
      </div>
    </aside>
  );
}

function PresetsCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — presets">
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
      </div>
    </aside>
  );
}

function ChatSettingsDrawer({
  children,
  drawerId,
  open,
  summary,
  title,
  onToggle,
}: {
  children: ReactNode;
  drawerId: ChatSettingsDrawerId;
  open: boolean;
  summary: string;
  title: string;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}) {
  const bodyId = `messenger-settings-${drawerId}-drawer`;

  return (
    <section className={`chat-settings-card${open ? " open" : ""}`}>
      <button
        type="button"
        className="chat-settings-section-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(drawerId)}
      >
        <span className="chat-settings-section-copy">
          <b>{title}</b>
          <small>{summary}</small>
        </span>
        <span className="chat-settings-drawer-icon" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="chat-settings-section-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

function ChatSettingsRail({
  chatSettingsOpen,
  nav,
  onCloseChatSettings,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const settingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";
  const activeMessengerThreadId =
    nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeMessengerThread = activeMessengerThreadId
    ? nav.messengerThreads.find((thread) => thread.id === activeMessengerThreadId) ??
      null
    : null;
  const [chatNameEditor, setChatNameEditor] = useState<{
    editing: boolean;
    threadId: string | null;
    value: string;
  }>({
    editing: false,
    threadId: activeMessengerThread?.id ?? null,
    value: activeMessengerThread?.title ?? "",
  });
  const [openDrawers, setOpenDrawers] = useState(CHAT_SETTINGS_DRAWER_DEFAULTS);
  const [companionSelectorOpen, setCompanionSelectorOpen] = useState(false);
  const [promptEditor, setPromptEditor] = useState<{
    open: boolean;
    threadId: string | null;
    value: string;
  }>({
    open: false,
    threadId: null,
    value: "",
  });
  const activeChatName = activeMessengerThread?.title.trim() || "Untitled chat";

  if (
    !chatNameEditor.editing &&
    chatNameEditor.threadId !== (activeMessengerThread?.id ?? null)
  ) {
    setChatNameEditor({
      editing: false,
      threadId: activeMessengerThread?.id ?? null,
      value: activeMessengerThread?.title ?? "",
    });
  }

  function startChatNameEdit() {
    if (!activeMessengerThread) return;
    setChatNameEditor({
      editing: true,
      threadId: activeMessengerThread.id,
      value: activeMessengerThread.title,
    });
  }

  function saveChatName() {
    if (!activeMessengerThread) return;
    const nextTitle = chatNameEditor.value.trim();
    if (nextTitle) {
      nav.renameMessengerThread(activeMessengerThread.id, nextTitle);
    }
    setChatNameEditor({
      editing: false,
      threadId: activeMessengerThread.id,
      value: nextTitle || activeMessengerThread.title,
    });
  }

  function cancelChatNameEdit() {
    setChatNameEditor({
      editing: false,
      threadId: activeMessengerThread?.id ?? null,
      value: activeMessengerThread?.title ?? "",
    });
  }

  function handleChatNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveChatName();
  }

  function handleChatNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelChatNameEdit();
    }
  }

  function toggleChatSettingsDrawer(drawerId: ChatSettingsDrawerId) {
    setOpenDrawers((current) => ({
      ...current,
      [drawerId]: !current[drawerId],
    }));
  }

  function updateActiveMessengerThread(
    updater: (thread: MessengerThread, updatedAt: string) => MessengerThread,
  ) {
    if (!activeMessengerThread) return;
    nav.updateMessengerThread(
      updater(activeMessengerThread, new Date().toISOString()),
    );
  }

  function handleMessengerConnectionChange(connectionId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadProviderConnection(
        thread,
        connectionId.trim() || null,
        updatedAt,
      ),
    );
  }

  function handleMessengerPersonaChange(personaId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadPersona(thread, personaId.trim() || null, updatedAt),
    );
  }

  function toggleMessengerCompanion(characterId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadParticipants(
        thread,
        thread.characterIds.includes(characterId)
          ? thread.characterIds.filter((id) => id !== characterId)
          : [...thread.characterIds, characterId],
        updatedAt,
      ),
    );
  }

  function toggleMessengerLorebook(lorebookId: string) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadLorebooks(
        thread,
        thread.lorebookIds.includes(lorebookId)
          ? thread.lorebookIds.filter((id) => id !== lorebookId)
          : [...thread.lorebookIds, lorebookId],
        updatedAt,
      ),
    );
  }

  function handleMessengerSystemPromptModeChange(
    systemPromptMode: MessengerSystemPromptMode,
  ) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadSystemPrompt(
        thread,
        systemPromptMode,
        thread.systemPrompt || DEFAULT_MESSENGER_SYSTEM_PROMPT,
        updatedAt,
      ),
    );
  }

  function openPromptEditor() {
    if (!activeMessengerThread) return;
    setPromptEditor({
      open: true,
      threadId: activeMessengerThread.id,
      value:
        activeMessengerThread.systemPromptMode === "custom"
          ? activeMessengerThread.systemPrompt || DEFAULT_MESSENGER_SYSTEM_PROMPT
          : DEFAULT_MESSENGER_SYSTEM_PROMPT,
    });
  }

  function closePromptEditor() {
    setPromptEditor({
      open: false,
      threadId: null,
      value: "",
    });
  }

  function savePromptEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMessengerThread || promptEditor.threadId !== activeMessengerThread.id) {
      closePromptEditor();
      return;
    }

    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadSystemPrompt(thread, "custom", promptEditor.value, updatedAt),
    );
    closePromptEditor();
  }

  const sanitizedProviderConnections = useMemo(
    () =>
      nav.providerConnections.map((connection) =>
        sanitizeProviderConnectionRecord(connection),
      ),
    [nav.providerConnections],
  );
  const defaultConnection =
    sanitizedProviderConnections.find(
      (connection) => connection.id === nav.appSettings.activeMessengerConnectionId,
    ) ??
    sanitizedProviderConnections[0] ??
    null;
  const defaultConnectionProvider = defaultConnection
    ? getProviderConnectionProviderOption(defaultConnection.provider)
    : null;
  const messengerConnectionValue = activeMessengerThread?.providerConnectionId ?? "";
  const selectedCompanionCount = activeMessengerThread?.characterIds.length ?? 0;
  const selectedCompanionNames = activeMessengerThread
    ? activeMessengerThread.characterIds.flatMap((characterId) => {
        const character = nav.characters.find(
          (candidate) => candidate.id === characterId,
        );
        return character ? [character.displayName] : [];
      })
    : [];
  const companionSelectionLabel =
    selectedCompanionNames.join(", ") || "Choose companions";
  const selectedLorebookCount = activeMessengerThread?.lorebookIds.length ?? 0;
  const systemPromptMode = activeMessengerThread?.systemPromptMode ?? "default";

  return (
    <aside className="shoal chat-settings-shoal" aria-label={`The Shoal — ${settingsLabel}`}>
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <div className="shoal-head chat-settings-head">
          <div className="shoal-title chat-settings-title">
            <h2>{settingsLabel}</h2>
            <button
              type="button"
              className="chat-settings-close"
              aria-label="Close chat settings"
              title="Close chat settings"
              onClick={onCloseChatSettings}
            >
              ×
            </button>
          </div>
          {nav.selectedSurface === MESSENGER && (
            <div className="chat-name-field">
              <span>Chat Name</span>
              {chatNameEditor.editing && activeMessengerThread ? (
                <form onSubmit={handleChatNameSubmit}>
                  <input
                    autoFocus
                    value={chatNameEditor.value}
                    onBlur={saveChatName}
                    onChange={(event) =>
                      setChatNameEditor({
                        editing: true,
                        threadId: activeMessengerThread.id,
                        value: event.currentTarget.value,
                      })
                    }
                    onKeyDown={handleChatNameKeyDown}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  disabled={!activeMessengerThread}
                  onClick={startChatNameEdit}
                >
                  {activeMessengerThread ? activeChatName : "No active chat"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="shoal-list chat-settings-list">
          <ChatSettingsDrawer
            drawerId="connection"
            open={openDrawers.connection}
            summary="Provider route"
            title="Connection"
            onToggle={toggleChatSettingsDrawer}
          >
            <label className="chat-settings-field">
              <span>Provider</span>
              <select
                className="pondsel"
                value={messengerConnectionValue}
                disabled={
                  !activeMessengerThread ||
                  sanitizedProviderConnections.length === 0
                }
                onChange={(event) =>
                  handleMessengerConnectionChange(event.currentTarget.value)
                }
              >
                {sanitizedProviderConnections.length === 0 ? (
                  <option value="">No connections</option>
                ) : (
                  <>
                    <option value="">
                      App default ·{" "}
                      {defaultConnection && defaultConnectionProvider
                        ? `${defaultConnection.label} · ${defaultConnectionProvider.label} · ${
                            defaultConnection.model || "No model"
                          }`
                        : "No connection"}
                    </option>
                    {sanitizedProviderConnections.map((connection) => {
                      const provider = getProviderConnectionProviderOption(
                        connection.provider,
                      );
                      const model = connection.model || "No model";

                      return (
                        <option value={connection.id} key={connection.id}>
                          {connection.label} · {provider.label} · {model}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
            </label>
          </ChatSettingsDrawer>

          <ChatSettingsDrawer
            drawerId="persona"
            open={openDrawers.persona}
            summary="Speaker identity"
            title="Persona"
            onToggle={toggleChatSettingsDrawer}
          >
            <label className="chat-settings-field">
              <span>Active persona</span>
              <select
                className="pondsel"
                value={activeMessengerThread?.activePersonaId ?? ""}
                disabled={!activeMessengerThread}
                onChange={(event) =>
                  handleMessengerPersonaChange(event.currentTarget.value)
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
          </ChatSettingsDrawer>

          <ChatSettingsDrawer
            drawerId="companions"
            open={openDrawers.companions}
            summary={`${selectedCompanionCount} selected`}
            title="Companions"
            onToggle={toggleChatSettingsDrawer}
          >
            <div
              className="chat-settings-field chat-settings-dropdown-field"
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                setCompanionSelectorOpen(false);
              }}
            >
              <span>Selected companions</span>
              <button
                type="button"
                className="chat-settings-select-button"
                aria-controls="messenger-settings-companion-menu"
                aria-expanded={companionSelectorOpen}
                aria-haspopup="listbox"
                disabled={!activeMessengerThread || nav.characters.length === 0}
                onClick={() => setCompanionSelectorOpen((open) => !open)}
              >
                <span>{companionSelectionLabel}</span>
                <small>{selectedCompanionCount}</small>
              </button>
              {companionSelectorOpen &&
                activeMessengerThread &&
                nav.characters.length > 0 && (
                  <div
                    className="chat-settings-select-menu"
                    id="messenger-settings-companion-menu"
                    role="listbox"
                    aria-multiselectable="true"
                  >
                    {nav.characters.map((character) => {
                      const selected =
                        activeMessengerThread.characterIds.includes(character.id);

                      return (
                        <label
                          className={`chat-settings-check${selected ? " on" : ""}`}
                          key={character.id}
                          role="option"
                          aria-selected={selected}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMessengerCompanion(character.id)}
                          />
                          <span>{character.displayName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
            </div>
          </ChatSettingsDrawer>

          <ChatSettingsDrawer
            drawerId="prompt"
            open={openDrawers.prompt}
            summary={
              systemPromptMode === "custom"
                ? "Custom system prompt"
                : "Default system prompt"
            }
            title="Prompt"
            onToggle={toggleChatSettingsDrawer}
          >
            <label className="chat-settings-field">
              <span>System prompt</span>
              <div className="chat-settings-prompt-select">
                <select
                  className="pondsel"
                  value={systemPromptMode}
                  disabled={!activeMessengerThread}
                  onChange={(event) =>
                    handleMessengerSystemPromptModeChange(
                      event.currentTarget.value as MessengerSystemPromptMode,
                    )
                  }
                >
                  <option value="default">Default</option>
                  <option value="custom">Custom</option>
                </select>
                <button
                  type="button"
                  className="chat-settings-edit-button"
                  disabled={!activeMessengerThread}
                  onClick={openPromptEditor}
                >
                  Edit
                </button>
              </div>
            </label>
          </ChatSettingsDrawer>

          <ChatSettingsDrawer
            drawerId="lorebooks"
            open={openDrawers.lorebooks}
            summary={`${selectedLorebookCount} lorebooks`}
            title="Lorebooks"
            onToggle={toggleChatSettingsDrawer}
          >
            <div className="chat-settings-field">
              <span>Selected lorebooks</span>
              {nav.lorebooks.length === 0 ? (
                <p className="chat-settings-empty-line">No lorebooks yet.</p>
              ) : (
                <div className="chat-settings-check-list">
                  {nav.lorebooks.map((lorebook) => {
                    const selected =
                      activeMessengerThread?.lorebookIds.includes(lorebook.id) ??
                      false;

                    return (
                      <label
                        className={`chat-settings-check${selected ? " on" : ""}`}
                        key={lorebook.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!activeMessengerThread}
                          onChange={() => toggleMessengerLorebook(lorebook.id)}
                        />
                        <span>{lorebook.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </ChatSettingsDrawer>

          <ChatSettingsDrawer
            drawerId="advanced"
            open={openDrawers.advanced}
            summary="Temperature and limits"
            title="Advanced Parameters"
            onToggle={toggleChatSettingsDrawer}
          >
            <div className="slider-field">
              <div className="sl-top">
                <b>Temperature</b>
                <span>{(nav.appSettings.defaultTemperature / 100).toFixed(2)}</span>
              </div>
              <Slider
                value={nav.appSettings.defaultTemperature}
                onChange={(value) =>
                  nav.updateAppSettings({ defaultTemperature: value })
                }
                min={0}
                max={200}
                step={5}
                ariaLabel={`${settingsLabel} temperature`}
              />
              <div className="track-ends">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="slider-field">
              <div className="sl-top">
                <b>Max tokens</b>
                <span>{nav.appSettings.defaultMaxTokens}</span>
              </div>
              <NumberField
                value={nav.appSettings.defaultMaxTokens}
                onChange={(value) =>
                  nav.updateAppSettings({ defaultMaxTokens: value })
                }
                min={64}
                max={8192}
                step={64}
                ariaLabel={`${settingsLabel} max tokens`}
              />
            </div>

            <div className="slider-field">
              <div className="sl-top">
                <b>Top-p</b>
                <span>{(nav.appSettings.defaultTopP / 100).toFixed(2)}</span>
              </div>
              <Slider
                value={nav.appSettings.defaultTopP}
                onChange={(value) => nav.updateAppSettings({ defaultTopP: value })}
                min={0}
                max={100}
                step={1}
                ariaLabel={`${settingsLabel} top-p`}
              />
              <div className="track-ends">
                <span>Focused</span>
                <span>Diverse</span>
              </div>
            </div>
          </ChatSettingsDrawer>
        </div>
      </div>
      {promptEditor.open && activeMessengerThread && (
        <div
          className="prompt-editor-backdrop"
          role="presentation"
          onClick={closePromptEditor}
        >
          <form
            className="prompt-editor-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messenger-prompt-editor-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={savePromptEditor}
          >
            <div className="prompt-editor-head">
              <b id="messenger-prompt-editor-title">System Prompt</b>
              <button
                type="button"
                aria-label="Close system prompt editor"
                onClick={closePromptEditor}
              >
                ×
              </button>
            </div>
            <label className="prompt-editor-field">
              <span>Prompt</span>
              <textarea
                autoFocus
                value={promptEditor.value}
                onChange={(event) =>
                  setPromptEditor((current) => ({
                    ...current,
                    value: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <div className="prompt-editor-actions">
              <button type="button" onClick={closePromptEditor}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}

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
  const activeSurface = nav.selectedSurface === ROLEPLAY ? ROLEPLAY : MESSENGER;
  const isRoleplaySurface = activeSurface === ROLEPLAY;
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeRoleplayThreadId =
    nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const characterById = useMemo(
    () => new Map(nav.characters.map((character) => [character.id, character])),
    [nav.characters],
  );
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
        }) || b.updatedAt.localeCompare(a.updatedAt)
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

  function getDraftCompanionName(characterIds: string[]) {
    return (
      characterIds
        .map((characterId) => characterById.get(characterId)?.displayName ?? "")
        .filter(Boolean)
        .join(" + ") || `New Messenger ${nav.messengerThreads.length + 1}`
    );
  }

  function getCompanionSelectionLabel(characterIds: string[]) {
    const names = characterIds
      .map((characterId) => characterById.get(characterId)?.displayName ?? "")
      .filter(Boolean);

    if (names.length === 0) return "Select companions";
    if (names.length <= 2) return names.join(" + ");
    return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
  }

  function getDraftRoleplayName(characterIds: string[]) {
    return (
      characterIds
        .map((characterId) => characterById.get(characterId)?.displayName ?? "")
        .filter(Boolean)
        .join(" + ") || `New Roleplay ${nav.roleplayThreads.length + 1}`
    );
  }

  function getLorebookSelectionLabel(lorebookIds: string[]) {
    const lorebookById = new Map(
      nav.lorebooks.map((lorebook) => [lorebook.id, lorebook.title]),
    );
    const names = lorebookIds
      .map((lorebookId) => lorebookById.get(lorebookId) ?? "")
      .filter(Boolean);

    if (names.length === 0) return "No lorebooks";
    if (names.length <= 2) return names.join(" + ");
    return `${names.slice(0, 2).join(" + ")} + ${names.length - 2} more`;
  }

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
      newMessengerName.trim() || getDraftCompanionName(newMessengerCharacterIds);
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
      newRoleplayName.trim() || getDraftRoleplayName(newRoleplayCharacterIds);
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
                <span>{getCompanionSelectionLabel(newMessengerCharacterIds)}</span>
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
                <span>{getCompanionSelectionLabel(newRoleplayCharacterIds)}</span>
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
                <span>{getLorebookSelectionLabel(newRoleplayLorebookIds)}</span>
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
