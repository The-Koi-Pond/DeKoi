import { ChatSettingsConnectionNotices } from "./ChatSettingsConnectionNotices";
import { ChatSettingsConnectionSelect } from "./ChatSettingsConnectionSelect";
import type { ChatSettingsConnectionDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsConnectionControlsProps {
  model: ChatSettingsConnectionDrawerModel;
  surfaceLabel?: string;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export function ChatSettingsConnectionControls({
  model,
  surfaceLabel = "Messenger",
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
}: ChatSettingsConnectionControlsProps) {
  return (
    <>
      <ChatSettingsConnectionSelect
        activeMessengerThread={model.activeMessengerThread}
        connections={model.connections}
        fallbackConnection={model.fallbackConnection}
        fallbackConnectionPrefix={model.fallbackConnectionPrefix}
        hasMissingConnection={model.hasMissingConnection}
        messengerConnectionValue={model.messengerConnectionValue}
        onConnectionChange={onConnectionChange}
      />
      <ChatSettingsConnectionNotices
        activeMessengerThread={model.activeMessengerThread}
        connectionCount={model.connections.length}
        hasMissingConnection={model.hasMissingConnection}
        missingConnectionResolution={model.missingConnectionResolution}
        surfaceLabel={surfaceLabel}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
      />
    </>
  );
}
