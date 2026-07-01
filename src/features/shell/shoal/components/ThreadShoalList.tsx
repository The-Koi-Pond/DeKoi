import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { MessengerThreadShoalList } from "./MessengerThreadShoalList";
import { RoleplayThreadShoalList } from "./RoleplayThreadShoalList";
import { ThreadShoalEmptyState } from "./ThreadShoalEmptyState";

interface ThreadShoalListProps {
  activeMessengerThreadId: string | null;
  activeRoleplayThreadId: string | null;
  characterById: Map<string, CharacterRecord>;
  isRoleplaySurface: boolean;
  messengerThreads: readonly MessengerThread[];
  roleplayThreads: readonly RoleplayThread[];
  onCreateActiveThread: () => void;
  onDeleteMessengerThread: (threadId: string, displayName: string) => void;
  onDeleteRoleplayThread: (threadId: string, title: string) => void;
  onOpenMessengerThread: (threadId: string) => void;
  onOpenRoleplayThread: (threadId: string) => void;
  onRenameRoleplayThread: (threadId: string, title: string) => void;
}

export function ThreadShoalList({
  activeMessengerThreadId,
  activeRoleplayThreadId,
  characterById,
  isRoleplaySurface,
  messengerThreads,
  roleplayThreads,
  onCreateActiveThread,
  onDeleteMessengerThread,
  onDeleteRoleplayThread,
  onOpenMessengerThread,
  onOpenRoleplayThread,
  onRenameRoleplayThread,
}: ThreadShoalListProps) {
  const visibleCount = isRoleplaySurface
    ? roleplayThreads.length
    : messengerThreads.length;

  return (
    <div className="shoal-list">
      {isRoleplaySurface ? (
        <RoleplayThreadShoalList
          activeRoleplayThreadId={activeRoleplayThreadId}
          characterById={characterById}
          roleplayThreads={roleplayThreads}
          onDeleteRoleplayThread={onDeleteRoleplayThread}
          onOpenRoleplayThread={onOpenRoleplayThread}
          onRenameRoleplayThread={onRenameRoleplayThread}
        />
      ) : (
        <MessengerThreadShoalList
          activeMessengerThreadId={activeMessengerThreadId}
          characterById={characterById}
          messengerThreads={messengerThreads}
          onDeleteMessengerThread={onDeleteMessengerThread}
          onOpenMessengerThread={onOpenMessengerThread}
        />
      )}
      {visibleCount === 0 && (
        <ThreadShoalEmptyState
          isRoleplaySurface={isRoleplaySurface}
          onCreateActiveThread={onCreateActiveThread}
        />
      )}
    </div>
  );
}
