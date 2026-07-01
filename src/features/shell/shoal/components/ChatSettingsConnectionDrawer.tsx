import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsConnectionControls } from "./ChatSettingsConnectionControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsConnectionDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsConnectionDrawerProps {
  activeMessengerThread: boolean;
  model: ChatSettingsConnectionDrawerModel;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsConnectionDrawer({
  activeMessengerThread,
  model,
  onConnectionChange,
  onCreateConnection,
  onResolveMissingConnection,
  onToggle,
}: ChatSettingsConnectionDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="connection"
      open={model.open}
      summary={model.summary}
      title="Connection"
      onToggle={onToggle}
    >
      <ChatSettingsConnectionControls
        activeMessengerThread={activeMessengerThread}
        model={model}
        onConnectionChange={onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
      />
    </ChatSettingsDrawer>
  );
}
