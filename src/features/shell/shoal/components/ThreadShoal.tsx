import { useNewThreadPopovers } from "../hooks/use-new-thread-popovers";
import { useThreadShoalViewModel } from "../hooks/use-thread-shoal-view-model";
import { useThreadReleaseActions } from "../hooks/use-thread-release-actions";
import type { ShoalRailProps } from "../types";
import { ShoalTopBar } from "./ShoalTopBar";
import { ThreadReleaseDialog } from "./ThreadReleaseDialog";
import { ThreadShoalHead } from "./ThreadShoalHead";
import { ThreadShoalList } from "./ThreadShoalList";
import { ThreadShoalPopovers } from "./ThreadShoalPopovers";

export function ThreadShoal({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const {
    activeMessengerThreadId,
    activeRoleplayThreadId,
    activeSurfaceLabel,
    characterById,
    defaultMessengerConnectionId,
    isRoleplaySurface,
    newThreadLabels,
    query,
    sanitizedProviderConnections,
    searchPlaceholder,
    sortLabel,
    threadShoalLists,
    cycleSortMode,
    setQuery,
  } = useThreadShoalViewModel({ nav });
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
          sortLabel={sortLabel}
          onCreateActiveThread={handleCreateActiveThread}
          onCycleSortMode={cycleSortMode}
          onQueryChange={setQuery}
        />
        <ThreadShoalList
          activeMessengerThreadId={activeMessengerThreadId}
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
