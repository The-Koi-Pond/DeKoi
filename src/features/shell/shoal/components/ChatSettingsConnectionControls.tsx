import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import {
  ChatSettingsConnectionNotices,
  type MissingConnectionResolution,
} from "./ChatSettingsConnectionNotices";
import { ChatSettingsConnectionSelect } from "./ChatSettingsConnectionSelect";

interface ChatSettingsConnectionControlsProps {
  activeMessengerThread: boolean;
  connections: ProviderConnectionRecord[];
  fallbackConnection: ProviderConnectionRecord | null;
  fallbackConnectionPrefix: string;
  hasMissingConnection: boolean;
  messengerConnectionValue: string;
  missingConnectionResolution: MissingConnectionResolution;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export function ChatSettingsConnectionControls({
  activeMessengerThread,
  connections,
  fallbackConnection,
  fallbackConnectionPrefix,
  hasMissingConnection,
  messengerConnectionValue,
  missingConnectionResolution,
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
}: ChatSettingsConnectionControlsProps) {
  return (
    <>
      <ChatSettingsConnectionSelect
        activeMessengerThread={activeMessengerThread}
        connections={connections}
        fallbackConnection={fallbackConnection}
        fallbackConnectionPrefix={fallbackConnectionPrefix}
        hasMissingConnection={hasMissingConnection}
        messengerConnectionValue={messengerConnectionValue}
        onConnectionChange={onConnectionChange}
      />
      <ChatSettingsConnectionNotices
        activeMessengerThread={activeMessengerThread}
        connectionCount={connections.length}
        hasMissingConnection={hasMissingConnection}
        missingConnectionResolution={missingConnectionResolution}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
      />
    </>
  );
}

export type { MissingConnectionResolution };
