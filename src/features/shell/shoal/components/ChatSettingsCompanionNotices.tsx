import { ChatSettingsNotice } from "./ChatSettingsBlocks";

interface ChatSettingsCompanionNoticesProps {
  activeMessengerThread: boolean;
  characterCount: number;
  missingCompanionCount: number;
  selectedCompanionCount: number;
  surfaceLabel?: string;
  onClearMissingCompanions: () => void;
  onCreateCompanion: () => void;
}

export function ChatSettingsCompanionNotices({
  activeMessengerThread,
  characterCount,
  missingCompanionCount,
  selectedCompanionCount,
  surfaceLabel = "Messenger",
  onClearMissingCompanions,
  onCreateCompanion,
}: ChatSettingsCompanionNoticesProps) {
  return (
    <>
      {missingCompanionCount > 0 && (
        <ChatSettingsNotice
          actionLabel="Clear missing"
          onAction={onClearMissingCompanions}
        >
          {missingCompanionCount} selected companion
          {missingCompanionCount === 1 ? " is" : "s are"} no longer saved.
          Missing companions are skipped when {surfaceLabel} builds a reply.
        </ChatSettingsNotice>
      )}
      {activeMessengerThread &&
        characterCount === 0 &&
        missingCompanionCount === 0 && (
          <ChatSettingsNotice
            actionLabel="Create companion"
            onAction={onCreateCompanion}
          >
            Create a companion before {surfaceLabel} can generate replies.
          </ChatSettingsNotice>
        )}
      {activeMessengerThread &&
        characterCount > 0 &&
        selectedCompanionCount === 0 && (
          <p className="chat-settings-empty-line">
            Choose at least one companion before generating replies.
          </p>
        )}
    </>
  );
}
