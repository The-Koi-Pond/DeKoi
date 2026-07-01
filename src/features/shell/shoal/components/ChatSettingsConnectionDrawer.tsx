import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import {
  ChatSettingsConnectionControls,
  type MissingConnectionResolution,
} from "./ChatSettingsConnectionControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsConnectionDrawerProps {
  activeMessengerThread: boolean;
  connections: ProviderConnectionRecord[];
  fallbackConnection: ProviderConnectionRecord | null;
  fallbackConnectionPrefix: string;
  hasMissingConnection: boolean;
  messengerConnectionValue: string;
  missingConnectionResolution: MissingConnectionResolution;
  open: boolean;
  summary: string;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsConnectionDrawer({
  activeMessengerThread,
  connections,
  fallbackConnection,
  fallbackConnectionPrefix,
  hasMissingConnection,
  messengerConnectionValue,
  missingConnectionResolution,
  open,
  summary,
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
  onToggle,
}: ChatSettingsConnectionDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="connection"
      open={open}
      summary={summary}
      title="Connection"
      onToggle={onToggle}
    >
      <ChatSettingsConnectionControls
        activeMessengerThread={activeMessengerThread}
        connections={connections}
        fallbackConnection={fallbackConnection}
        fallbackConnectionPrefix={fallbackConnectionPrefix}
        hasMissingConnection={hasMissingConnection}
        messengerConnectionValue={messengerConnectionValue}
        missingConnectionResolution={missingConnectionResolution}
        onConnectionChange={onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
      />
    </ChatSettingsDrawer>
  );
}
