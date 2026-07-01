import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import { getChatSettingsIdentityDrawerModels } from "../lib/chat-settings-identity-drawer-models";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsIdentityDrawersProps {
  actions: Pick<ChatSettingsMessengerActionGroup, "drawers" | "identity">;
  activeMessengerThread: boolean;
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  personas: ShoalRailProps["nav"]["personas"];
  viewModel: ChatSettingsViewModel;
  onCreateConnection: () => void;
}

export function ChatSettingsIdentityDrawers({
  actions,
  activeMessengerThread,
  openDrawers,
  personas,
  viewModel,
  onCreateConnection,
}: ChatSettingsIdentityDrawersProps) {
  const {
    connection: connectionModel,
    persona: personaModel,
  } = getChatSettingsIdentityDrawerModels({ openDrawers, viewModel });

  return (
    <>
      <ChatSettingsConnectionDrawer
        activeMessengerThread={activeMessengerThread}
        model={connectionModel}
        onConnectionChange={actions.identity.onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={actions.identity.onResolveMissingConnection}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPersonaDrawer
        activeMessengerThread={activeMessengerThread}
        model={personaModel}
        personas={personas}
        onPersonaChange={actions.identity.onPersonaChange}
        onToggle={actions.drawers.onToggle}
      />
    </>
  );
}
