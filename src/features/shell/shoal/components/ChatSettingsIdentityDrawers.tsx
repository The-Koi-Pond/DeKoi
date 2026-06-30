import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsIdentityDrawersProps {
  activeMessengerThread: boolean;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  personas: ShoalRailProps["nav"]["personas"];
  viewModel: ChatSettingsViewModel;
  onConnectionChange: (connectionId: string) => void;
  onCreateConnection: () => void;
  onPersonaChange: (personaId: string) => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsIdentityDrawers({
  activeMessengerThread,
  openDrawers,
  personas,
  viewModel,
  onConnectionChange,
  onCreateConnection,
  onPersonaChange,
  onResolveMissingConnection,
  onToggle,
}: ChatSettingsIdentityDrawersProps) {
  return (
    <>
      <ChatSettingsConnectionDrawer
        activeMessengerThread={activeMessengerThread}
        connections={viewModel.sanitizedProviderConnections}
        fallbackConnection={viewModel.fallbackConnection}
        fallbackConnectionPrefix={viewModel.fallbackConnectionPrefix}
        hasMissingConnection={viewModel.hasMissingConnection}
        messengerConnectionValue={viewModel.messengerConnectionValue}
        missingConnectionResolution={viewModel.missingConnectionResolution}
        open={openDrawers.connection}
        summary={viewModel.connectionSummary}
        onConnectionChange={onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
        onToggle={onToggle}
      />

      <ChatSettingsPersonaDrawer
        activeMessengerThread={activeMessengerThread}
        hasMissingPersona={viewModel.hasMissingPersona}
        open={openDrawers.persona}
        personas={personas}
        selectedPersonaId={viewModel.selectedPersonaId}
        summary={viewModel.personaSummary}
        onPersonaChange={onPersonaChange}
        onToggle={onToggle}
      />
    </>
  );
}
