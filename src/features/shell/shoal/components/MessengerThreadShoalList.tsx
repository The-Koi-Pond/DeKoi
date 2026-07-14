import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { MessengerModeThread } from "../../../../engine/contracts/types/mode-thread";
import { KoiCard } from "../KoiCard";
import { getMessengerCardDetails } from "../lib/messenger-card-details";

interface MessengerThreadShoalListProps {
  activeMessengerThreadId: string | null;
  characterById: Map<string, CharacterRecord>;
  messengerThreads: readonly MessengerModeThread[];
  onDeleteMessengerThread: (threadId: string, displayName: string) => void;
  onOpenMessengerThread: (threadId: string) => void;
}

export function MessengerThreadShoalList({
  activeMessengerThreadId,
  characterById,
  messengerThreads,
  onDeleteMessengerThread,
  onOpenMessengerThread,
}: MessengerThreadShoalListProps) {
  return (
    <>
      {messengerThreads.map((thread) => {
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
    </>
  );
}
