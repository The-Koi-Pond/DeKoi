import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { RoleplayModeThread } from "../../../../engine/contracts/types/mode-thread";
import { getActiveModeBranch } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import { getRoleplayThreadPreview } from "../../../modes";
import { KoiCard } from "../KoiCard";
import { getRoleplayCardAvatarDetails } from "../lib/roleplay-card-avatar-details";
import { RoleplayCardIcon } from "./ShoalIcons";

interface RoleplayThreadShoalListProps {
  activeRoleplayThreadId: string | null;
  characterById: Map<string, CharacterRecord>;
  roleplayThreads: readonly RoleplayModeThread[];
  onDeleteRoleplayThread: (threadId: string, title: string) => void;
  onOpenRoleplayThread: (threadId: string) => void;
  onRenameRoleplayThread: (threadId: string, title: string) => void;
}

export function RoleplayThreadShoalList({
  activeRoleplayThreadId,
  characterById,
  roleplayThreads,
  onDeleteRoleplayThread,
  onOpenRoleplayThread,
  onRenameRoleplayThread,
}: RoleplayThreadShoalListProps) {
  return (
    <>
      {roleplayThreads.map((thread) => {
        const branch = getActiveModeBranch(thread);
        const avatarDetails = getRoleplayCardAvatarDetails(
          branch.characterIds,
          thread.title,
          characterById,
        );
        const preview = getRoleplayThreadPreview(thread);
        const missingCompanionLabel =
          avatarDetails.missingCharacterCount === 1
            ? "1 missing companion reference"
            : `${avatarDetails.missingCharacterCount} missing companion references`;

        return (
          <KoiCard
            key={thread.id}
            avatarLabel={avatarDetails.avatarLabel}
            avatarUrl={avatarDetails.avatarUrl}
            icon={avatarDetails.hasCharacter ? undefined : <RoleplayCardIcon />}
            initials={avatarDetails.initials}
            name={thread.title}
            sub={avatarDetails.missingCharacterCount > 0 ? missingCompanionLabel : preview}
            mode="roleplay"
            active={thread.id === activeRoleplayThreadId}
            showStatus={false}
            onOpen={() => onOpenRoleplayThread(thread.id)}
            onRename={() => onRenameRoleplayThread(thread.id, thread.title)}
            onDelete={() => onDeleteRoleplayThread(thread.id, thread.title)}
          />
        );
      })}
    </>
  );
}
