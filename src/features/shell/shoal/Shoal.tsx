import {
  useMemo,
  useState,
} from "react";
import type { ShoalSortMode } from "../../../engine/contracts/types/app-settings";
import { sanitizeProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { ROLEPLAY, MESSENGER } from "../../../engine/contracts/constants/surfaces";
import { getThreadShoalLists } from "./lib/thread-shoal-lists";
import { createNewThreadLabels } from "./lib/new-thread-labels";
import { useNewThreadPopovers } from "./hooks/use-new-thread-popovers";
import { useThreadReleaseActions } from "./hooks/use-thread-release-actions";
import { ConnectionsCatalogRail } from "./components/ConnectionsCatalogRail";
import { LorebookCatalogRail } from "./components/LorebookCatalogRail";
import { PeopleCatalogRail } from "./components/PeopleCatalogRail";
import { ShoalTopBar } from "./components/ShoalTopBar";
import {
  MediaCatalogRail,
  PresetsCatalogRail,
} from "./components/StaticCatalogRails";
import { ChatSettingsRail } from "./components/ChatSettingsRail";
import {
  ThreadReleaseDialog,
} from "./components/ThreadReleaseDialog";
import { ThreadShoalHead } from "./components/ThreadShoalHead";
import { ThreadShoalList } from "./components/ThreadShoalList";
import { ThreadShoalPopovers } from "./components/ThreadShoalPopovers";
import type { ShoalProps, ShoalRailProps } from "./types";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

function ThreadShoal({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const [query, setQuery] = useState("");
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
  const newThreadLabels = useMemo(
    () =>
      createNewThreadLabels({
        characterById,
        lorebooks: nav.lorebooks,
        nextMessengerThreadNumber,
        nextRoleplayThreadNumber,
      }),
    [
      characterById,
      nav.lorebooks,
      nextMessengerThreadNumber,
      nextRoleplayThreadNumber,
    ],
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
  const newThreadPopovers = useNewThreadPopovers({
    characters: nav.characters,
    defaultMessengerConnectionId,
    isRoleplaySurface,
    labels: newThreadLabels,
    lorebooks: nav.lorebooks,
    onCreateMessengerThread: nav.createMessengerThread,
    onCreateRoleplayThread: nav.createRoleplayThread,
    roleplayPersonaId: nav.personas[0]?.id ?? "",
  });
  const { handleCreateActiveThread, newMessengerOpen, newRoleplayOpen } =
    newThreadPopovers;
  const threadShoalLists = useMemo(
    () =>
      getThreadShoalLists({
        characterById,
        messengerThreads: nav.messengerThreads,
        query,
        roleplayThreads: nav.roleplayThreads,
        sortMode,
      }),
    [characterById, nav.messengerThreads, nav.roleplayThreads, query, sortMode],
  );
  const {
    clearReleaseRequest,
    confirmReleaseThread,
    handleDeleteMessenger,
    handleDeleteRoleplay,
    handleRenameRoleplay,
    releaseRequest,
  } = useThreadReleaseActions({
    confirmRelease: nav.appSettings.confirmRelease,
    onDeleteMessengerThread: nav.deleteMessengerThread,
    onDeleteRoleplayThread: nav.deleteRoleplayThread,
    onRenameRoleplayThread: nav.renameRoleplayThread,
  });

  function cycleSortMode() {
    const currentIndex = SHOAL_SORT_ORDER.indexOf(sortMode);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % SHOAL_SORT_ORDER.length;
    nav.setShoalSortMode(SHOAL_SORT_ORDER[nextIndex]);
  }

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
        <ThreadShoalHead
          activeSurfaceLabel={activeSurfaceLabel}
          isRoleplaySurface={isRoleplaySurface}
          newMessengerOpen={newMessengerOpen}
          newRoleplayOpen={newRoleplayOpen}
          query={query}
          searchPlaceholder={searchPlaceholder}
          sortLabel={SHOAL_SORT_LABELS[sortMode]}
          onCreateActiveThread={handleCreateActiveThread}
          onCycleSortMode={cycleSortMode}
          onQueryChange={setQuery}
        />
        <ThreadShoalList
          activeMessengerThreadId={activeThreadId}
          activeRoleplayThreadId={activeRoleplayThreadId}
          characterById={characterById}
          isRoleplaySurface={isRoleplaySurface}
          messengerThreads={threadShoalLists.messengerThreads}
          roleplayThreads={threadShoalLists.roleplayThreads}
          onCreateActiveThread={handleCreateActiveThread}
          onDeleteMessengerThread={handleDeleteMessenger}
          onDeleteRoleplayThread={handleDeleteRoleplay}
          onOpenMessengerThread={nav.openMessengerThread}
          onOpenRoleplayThread={nav.openRoleplayThread}
          onRenameRoleplayThread={handleRenameRoleplay}
        />
      </div>
      <ThreadShoalPopovers
        characters={nav.characters}
        connections={sanitizedProviderConnections}
        isRoleplaySurface={isRoleplaySurface}
        labels={newThreadLabels}
        lorebooks={nav.lorebooks}
        personas={nav.personas}
        popovers={newThreadPopovers}
      />
      {releaseRequest && (
        <ThreadReleaseDialog
          request={releaseRequest}
          onCancel={clearReleaseRequest}
          onConfirm={confirmReleaseThread}
        />
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
