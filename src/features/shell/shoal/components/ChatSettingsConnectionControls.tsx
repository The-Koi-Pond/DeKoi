import { ChatSettingsConnectionNotices } from "./ChatSettingsConnectionNotices";
import { ChatSettingsConnectionSelect } from "./ChatSettingsConnectionSelect";
import type { ChatSettingsConnectionDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsConnectionControlsProps {
  activeMessengerThread: boolean;
  model: ChatSettingsConnectionDrawerModel;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
}

export function ChatSettingsConnectionControls({
  activeMessengerThread,
  model,
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
}: ChatSettingsConnectionControlsProps) {
  return (
    <>
      <ChatSettingsConnectionSelect
        activeMessengerThread={activeMessengerThread}
        connections={model.connections}
        fallbackConnection={model.fallbackConnection}
        fallbackConnectionPrefix={model.fallbackConnectionPrefix}
        hasMissingConnection={model.hasMissingConnection}
        messengerConnectionValue={model.messengerConnectionValue}
        onConnectionChange={onConnectionChange}
      />
      <ChatSettingsConnectionNotices
        activeMessengerThread={activeMessengerThread}
        connectionCount={model.connections.length}
        hasMissingConnection={model.hasMissingConnection}
        missingConnectionResolution={model.missingConnectionResolution}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
      />
    </>
  );
}
