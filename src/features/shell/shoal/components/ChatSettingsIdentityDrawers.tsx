import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsIdentityDrawerModels } from "../lib/chat-settings-identity-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsIdentityDrawersProps {
  actions: Pick<ChatSettingsMessengerActionGroup, "drawers" | "identity">;
  models: ChatSettingsIdentityDrawerModels;
  personas: ShoalRailProps["nav"]["personas"];
  surfaceLabel?: string;
  onCreateConnection: () => void;
}

export function ChatSettingsIdentityDrawers({
  actions,
  models,
  personas,
  surfaceLabel = "Messenger",
  onCreateConnection,
}: ChatSettingsIdentityDrawersProps) {
  return (
    <>
      <ChatSettingsConnectionDrawer
        model={models.connection}
        surfaceLabel={surfaceLabel}
        onConnectionChange={actions.identity.onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={actions.identity.onResolveMissingConnection}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPersonaDrawer
        model={models.persona}
        personas={personas}
        onPersonaChange={actions.identity.onPersonaChange}
        onToggle={actions.drawers.onToggle}
      />
    </>
  );
}
