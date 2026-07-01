import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type { ShoalNav } from "../types";
import { ThreadShoalHead } from "./ThreadShoalHead";
import { ThreadShoalList } from "./ThreadShoalList";

interface ThreadShoalBodyProps {
  activeMessengerThreadId: string | null;
  activeRoleplayThreadId: string | null;
  activeSurfaceLabel: string;
  characterById: Map<string, CharacterRecord>;
  isRoleplaySurface: boolean;
  messengerThreads: readonly MessengerThread[];
  newMessengerOpen: boolean;
  newRoleplayOpen: boolean;
  query: string;
  roleplayThreads: readonly RoleplayThread[];
  searchPlaceholder: string;
  sortLabel: string;
  onCreateActiveThread: () => void;
  onCycleSortMode: () => void;
  onDeleteMessengerThread: (threadId: string, displayName: string) => void;
  onDeleteRoleplayThread: (threadId: string, title: string) => void;
  onOpenMessengerThread: ShoalNav["openMessengerThread"];
  onOpenRoleplayThread: ShoalNav["openRoleplayThread"];
  onQueryChange: (query: string) => void;
  onRenameRoleplayThread: (threadId: string, title: string) => void;
}

export function ThreadShoalBody({
  activeMessengerThreadId,
  activeRoleplayThreadId,
  activeSurfaceLabel,
  characterById,
  isRoleplaySurface,
  messengerThreads,
  newMessengerOpen,
  newRoleplayOpen,
  query,
  roleplayThreads,
  searchPlaceholder,
  sortLabel,
  onCreateActiveThread,
  onCycleSortMode,
  onDeleteMessengerThread,
  onDeleteRoleplayThread,
  onOpenMessengerThread,
  onOpenRoleplayThread,
  onQueryChange,
  onRenameRoleplayThread,
}: ThreadShoalBodyProps) {
  return (
    <div className="shoal-body">
      <ThreadShoalHead
        activeSurfaceLabel={activeSurfaceLabel}
        isRoleplaySurface={isRoleplaySurface}
        newMessengerOpen={newMessengerOpen}
        newRoleplayOpen={newRoleplayOpen}
        query={query}
        searchPlaceholder={searchPlaceholder}
        sortLabel={sortLabel}
        onCreateActiveThread={onCreateActiveThread}
        onCycleSortMode={onCycleSortMode}
        onQueryChange={onQueryChange}
      />
      <ThreadShoalList
        activeMessengerThreadId={activeMessengerThreadId}
        activeRoleplayThreadId={activeRoleplayThreadId}
        characterById={characterById}
        isRoleplaySurface={isRoleplaySurface}
        messengerThreads={messengerThreads}
        roleplayThreads={roleplayThreads}
        onCreateActiveThread={onCreateActiveThread}
        onDeleteMessengerThread={onDeleteMessengerThread}
        onDeleteRoleplayThread={onDeleteRoleplayThread}
        onOpenMessengerThread={onOpenMessengerThread}
        onOpenRoleplayThread={onOpenRoleplayThread}
        onRenameRoleplayThread={onRenameRoleplayThread}
      />
    </div>
  );
}
