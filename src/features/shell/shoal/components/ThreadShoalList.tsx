import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { getRoleplayThreadPreview } from "../../../modes";
import { KoiCard } from "../KoiCard";
import { getMessengerCardDetails } from "../lib/messenger-card-details";
import { getRoleplayCardAvatarDetails } from "../lib/roleplay-card-avatar-details";
import { RoleplayCardIcon } from "./ShoalIcons";
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
      {isRoleplaySurface
        ? roleplayThreads.map((thread) => {
            const avatarDetails = getRoleplayCardAvatarDetails(
              thread.characterIds,
              thread.title,
              characterById,
            );
            const preview = getRoleplayThreadPreview(thread);
            const missingCompanionLabel =
              avatarDetails.missingCharacterCount === 1
                ? "1 missing companion"
                : `${avatarDetails.missingCharacterCount} missing companions`;

            return (
              <KoiCard
                key={thread.id}
                avatarLabel={avatarDetails.avatarLabel}
                avatarUrl={avatarDetails.avatarUrl}
                icon={avatarDetails.hasCharacter ? undefined : <RoleplayCardIcon />}
                initials={avatarDetails.initials}
                name={thread.title}
                sub={
                  avatarDetails.missingCharacterCount > 0
                    ? `${missingCompanionLabel} - ${preview}`
                    : preview
                }
                mode="roleplay"
                active={thread.id === activeRoleplayThreadId}
                showStatus={false}
                onOpen={() => onOpenRoleplayThread(thread.id)}
                onRename={() => onRenameRoleplayThread(thread.id, thread.title)}
                onDelete={() => onDeleteRoleplayThread(thread.id, thread.title)}
              />
            );
          })
        : messengerThreads.map((thread) => {
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
                active={thread.id === activeMessengerThreadId}
                online
                onOpen={() => onOpenMessengerThread(thread.id)}
                onDelete={() => onDeleteMessengerThread(thread.id, details.name)}
              />
            );
          })}
      {visibleCount === 0 && (
        <ThreadShoalEmptyState
          isRoleplaySurface={isRoleplaySurface}
          onCreateActiveThread={onCreateActiveThread}
        />
      )}
    </div>
  );
}
