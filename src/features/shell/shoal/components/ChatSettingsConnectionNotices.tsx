import { ChatSettingsNotice } from "./ChatSettingsBlocks";

export interface MissingConnectionResolution {
  actionLabel: string;
  connectionId: string | null;
}

interface ChatSettingsConnectionNoticesProps {
  activeMessengerThread: boolean;
  connectionCount: number;
  hasMissingConnection: boolean;
  missingConnectionResolution: MissingConnectionResolution;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export function ChatSettingsConnectionNotices({
  activeMessengerThread,
  connectionCount,
  hasMissingConnection,
  missingConnectionResolution,
  onCreateConnection,
  onResolveMissingConnection,
}: ChatSettingsConnectionNoticesProps) {
  return (
    <>
      {hasMissingConnection && (
        <ChatSettingsNotice
          actionLabel={missingConnectionResolution.actionLabel}
          onAction={() =>
            onResolveMissingConnection(missingConnectionResolution.connectionId)
          }
        >
          This thread points to a connection that is no longer saved. Choose
          another connection or clear the missing reference.
        </ChatSettingsNotice>
      )}
      {activeMessengerThread &&
        connectionCount === 0 &&
        !hasMissingConnection && (
          <ChatSettingsNotice
            actionLabel="Create connection"
            onAction={onCreateConnection}
          >
            Create a connection before Messenger can generate replies.
          </ChatSettingsNotice>
        )}
    </>
  );
}
