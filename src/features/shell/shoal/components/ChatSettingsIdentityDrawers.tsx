import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import type { ChatSettingsMessengerActionGroup } from "../lib/chat-settings-controller-groups";
import type { ChatSettingsIdentityDrawerModels } from "../lib/chat-settings-identity-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsIdentityDrawersProps {
  actions: Pick<ChatSettingsMessengerActionGroup, "drawers" | "identity">;
  activeMessengerThread: boolean;
  models: ChatSettingsIdentityDrawerModels;
  personas: ShoalRailProps["nav"]["personas"];
  onCreateConnection: () => void;
}

export function ChatSettingsIdentityDrawers({
  actions,
  activeMessengerThread,
  models,
  personas,
  onCreateConnection,
}: ChatSettingsIdentityDrawersProps) {
  return (
    <>
      <ChatSettingsConnectionDrawer
        activeMessengerThread={activeMessengerThread}
        model={models.connection}
        onConnectionChange={actions.identity.onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={actions.identity.onResolveMissingConnection}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsPersonaDrawer
        activeMessengerThread={activeMessengerThread}
        model={models.persona}
        personas={personas}
        onPersonaChange={actions.identity.onPersonaChange}
        onToggle={actions.drawers.onToggle}
      />
    </>
  );
}
