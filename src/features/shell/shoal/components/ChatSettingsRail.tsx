import { useMemo, useState, type FormEvent } from "react";
import {
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadProviderConnection,
  setMessengerThreadSystemPrompt,
} from "../../../../engine/modes/messenger/messenger-actions";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { sanitizeProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import { ChatSettingsNameEditor } from "./ChatSettingsNameEditor";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import { ChatSettingsPromptDrawer } from "./ChatSettingsPromptDrawer";
import { ChatSettingsPromptEditor } from "./ChatSettingsPromptEditor";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ShoalTopBar } from "./ShoalTopBar";
import {
  CHAT_SETTINGS_DRAWER_DEFAULTS,
  type ChatSettingsDrawerId,
} from "../lib/chat-settings-drawers";
import type { ShoalRailProps } from "../types";

export function ChatSettingsRail({
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

  function resolveMissingMessengerConnection(connectionId: string | null) {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadProviderConnection(
        thread,
        connectionId,
        updatedAt,
      ),
    );
  }

  function clearMissingMessengerCompanions() {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadParticipants(
        thread,
        thread.characterIds.filter((characterId) =>
          nav.characters.some((character) => character.id === characterId),
        ),
        updatedAt,
      ),
    );
    setCompanionSelectorOpen(false);
  }

  function clearMissingMessengerLorebooks() {
    updateActiveMessengerThread((thread, updatedAt) =>
      setMessengerThreadLorebooks(
        thread,
        thread.lorebookIds.filter((lorebookId) =>
          nav.lorebooks.some((lorebook) => lorebook.id === lorebookId),
        ),
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
  const settingsCharacterById = useMemo(
    () => new Map(nav.characters.map((character) => [character.id, character])),
    [nav.characters],
  );
  const settingsPersonaById = useMemo(
    () => new Map(nav.personas.map((persona) => [persona.id, persona])),
    [nav.personas],
  );
  const settingsLorebookById = useMemo(
    () => new Map(nav.lorebooks.map((lorebook) => [lorebook.id, lorebook])),
    [nav.lorebooks],
  );
  const settingsConnectionById = useMemo(
    () =>
      new Map(
        sanitizedProviderConnections.map((connection) => [
          connection.id,
          connection,
        ]),
      ),
    [sanitizedProviderConnections],
  );
  const configuredDefaultConnection =
    settingsConnectionById.get(nav.appSettings.activeMessengerConnectionId) ?? null;
  const firstAvailableConnection = sanitizedProviderConnections[0] ?? null;
  const fallbackConnection =
    configuredDefaultConnection ?? firstAvailableConnection;
  const fallbackConnectionPrefix = configuredDefaultConnection
    ? "App default"
    : "First available";
  const missingConnectionResolution = configuredDefaultConnection
    ? {
        actionLabel: "Use app default",
        connectionId: configuredDefaultConnection.id,
      }
    : firstAvailableConnection
      ? {
          actionLabel: "Use first available",
          connectionId: firstAvailableConnection.id,
        }
      : {
          actionLabel: "Clear missing",
          connectionId: null,
        };
  const messengerConnectionValue = activeMessengerThread?.providerConnectionId ?? "";
  const selectedConnection = messengerConnectionValue
    ? settingsConnectionById.get(messengerConnectionValue) ?? null
    : null;
  const hasMissingConnection = !!messengerConnectionValue && !selectedConnection;
  const connectionSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : hasMissingConnection
      ? "Missing connection"
      : selectedConnection
        ? selectedConnection.label
        : fallbackConnection
          ? `${fallbackConnectionPrefix}: ${fallbackConnection.label}`
          : "No connection available";
  const selectedPersonaId = activeMessengerThread?.activePersonaId ?? "";
  const selectedPersona = selectedPersonaId
    ? settingsPersonaById.get(selectedPersonaId) ?? null
    : null;
  const hasMissingPersona = !!selectedPersonaId && !selectedPersona;
  const personaSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : hasMissingPersona
      ? "Missing persona"
      : selectedPersona
        ? selectedPersona.displayName
        : "Anonymous";
  const selectedCompanionIds = activeMessengerThread?.characterIds ?? [];
  const selectedCompanionNames = activeMessengerThread
    ? activeMessengerThread.characterIds.flatMap((characterId) => {
        const character = settingsCharacterById.get(characterId);
        return character ? [character.displayName] : [];
      })
    : [];
  const missingCompanionIds = selectedCompanionIds.filter(
    (characterId) => !settingsCharacterById.has(characterId),
  );
  const selectedCompanionCount = selectedCompanionIds.length;
  const missingCompanionCount = missingCompanionIds.length;
  const companionDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingCompanionCount > 0
      ? `${selectedCompanionNames.length} selected, ${missingCompanionCount} missing`
      : selectedCompanionCount === 0
        ? "No companions selected"
        : `${selectedCompanionCount} selected`;
  const companionSelectionLabel =
    selectedCompanionNames.join(", ") ||
    (missingCompanionCount > 0
      ? `${missingCompanionCount} missing companion${
          missingCompanionCount === 1 ? "" : "s"
        }`
      : "Choose companions");
  const selectedLorebookIds = activeMessengerThread?.lorebookIds ?? [];
  const selectedLorebookNames = activeMessengerThread
    ? activeMessengerThread.lorebookIds.flatMap((lorebookId) => {
        const lorebook = settingsLorebookById.get(lorebookId);
        return lorebook ? [lorebook.title] : [];
      })
    : [];
  const missingLorebookIds = selectedLorebookIds.filter(
    (lorebookId) => !settingsLorebookById.has(lorebookId),
  );
  const selectedLorebookCount = selectedLorebookIds.length;
  const missingLorebookCount = missingLorebookIds.length;
  const lorebookDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingLorebookCount > 0
      ? `${selectedLorebookNames.length} selected, ${missingLorebookCount} missing`
      : selectedLorebookCount === 0
        ? "No lorebooks selected"
        : `${selectedLorebookCount} lorebook${
            selectedLorebookCount === 1 ? "" : "s"
          }`;
  const systemPromptMode = activeMessengerThread?.systemPromptMode ?? "default";

  if (nav.selectedSurface !== MESSENGER) {
    return (
      <aside
        className="shoal chat-settings-shoal"
        aria-label={`The Shoal - ${settingsLabel}`}
      >
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
          </div>
          <div className="shoal-list chat-settings-list">
            <ChatSettingsNotice>
              Roleplay settings are not ready yet. Open a Messenger thread to
              adjust Messenger-specific connection, persona, companion, prompt,
              and lore settings.
            </ChatSettingsNotice>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="shoal chat-settings-shoal"
      aria-label={`The Shoal - ${settingsLabel}`}
    >
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
            <ChatSettingsNameEditor
              activeChatName={activeChatName}
              disabled={!activeMessengerThread}
              editing={chatNameEditor.editing}
              value={chatNameEditor.value}
              onCancel={cancelChatNameEdit}
              onSave={saveChatName}
              onStartEdit={startChatNameEdit}
              onValueChange={(value) =>
                setChatNameEditor({
                  editing: true,
                  threadId: activeMessengerThread?.id ?? null,
                  value,
                })
              }
            />
          )}
        </div>
        <div className="shoal-list chat-settings-list">
          {!activeMessengerThread && (
            <ChatSettingsNotice
              actionLabel="New Messenger"
              onAction={() => nav.createMessengerThread()}
            >
              Open or create a Messenger thread to edit connection, persona,
              companion, prompt, and lore settings.
            </ChatSettingsNotice>
          )}
          <ChatSettingsConnectionDrawer
            activeMessengerThread={!!activeMessengerThread}
            connections={sanitizedProviderConnections}
            fallbackConnection={fallbackConnection}
            fallbackConnectionPrefix={fallbackConnectionPrefix}
            hasMissingConnection={hasMissingConnection}
            messengerConnectionValue={messengerConnectionValue}
            missingConnectionResolution={missingConnectionResolution}
            open={openDrawers.connection}
            summary={connectionSummary}
            onConnectionChange={handleMessengerConnectionChange}
            onCreateConnection={() =>
              nav.setView({ kind: "connections", mode: "new" })
            }
            onResolveMissingConnection={resolveMissingMessengerConnection}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsPersonaDrawer
            activeMessengerThread={!!activeMessengerThread}
            hasMissingPersona={hasMissingPersona}
            open={openDrawers.persona}
            personas={nav.personas}
            selectedPersonaId={selectedPersonaId}
            summary={personaSummary}
            onPersonaChange={handleMessengerPersonaChange}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsCompanionsDrawer
            activeMessengerThread={!!activeMessengerThread}
            characters={nav.characters}
            companionSelectorOpen={companionSelectorOpen}
            missingCompanionCount={missingCompanionCount}
            open={openDrawers.companions}
            selectedCompanionCount={selectedCompanionCount}
            selectedCompanionIds={selectedCompanionIds}
            selectionLabel={companionSelectionLabel}
            summary={companionDrawerSummary}
            onClearMissingCompanions={clearMissingMessengerCompanions}
            onCreateCompanion={() =>
              nav.setView({ kind: "companions", mode: "new" })
            }
            onSelectorOpenChange={setCompanionSelectorOpen}
            onToggle={toggleChatSettingsDrawer}
            onToggleCompanion={toggleMessengerCompanion}
          />

          <ChatSettingsPromptDrawer
            activeMessengerThread={!!activeMessengerThread}
            open={openDrawers.prompt}
            systemPromptMode={systemPromptMode}
            onOpenPromptEditor={openPromptEditor}
            onSystemPromptModeChange={handleMessengerSystemPromptModeChange}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsLorebooksDrawer
            activeMessengerThread={!!activeMessengerThread}
            lorebooks={nav.lorebooks}
            missingLorebookCount={missingLorebookCount}
            open={openDrawers.lorebooks}
            selectedLorebookIds={selectedLorebookIds}
            summary={lorebookDrawerSummary}
            onClearMissingLorebooks={clearMissingMessengerLorebooks}
            onCreateLorebook={() =>
              nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
            }
            onToggle={toggleChatSettingsDrawer}
            onToggleLorebook={toggleMessengerLorebook}
          />

          <ChatSettingsAdvancedDrawer
            appSettings={nav.appSettings}
            open={openDrawers.advanced}
            settingsLabel={settingsLabel}
            onToggle={toggleChatSettingsDrawer}
            updateAppSettings={nav.updateAppSettings}
          />
        </div>
      </div>
      <ChatSettingsPromptEditor
        open={promptEditor.open && !!activeMessengerThread}
        value={promptEditor.value}
        onClose={closePromptEditor}
        onSave={savePromptEditor}
        onValueChange={(value) =>
          setPromptEditor((current) => ({
            ...current,
            value,
          }))
        }
      />
    </aside>
  );
}
