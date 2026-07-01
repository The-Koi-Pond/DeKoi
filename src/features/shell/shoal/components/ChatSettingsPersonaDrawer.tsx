import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsPersonaControls } from "./ChatSettingsPersonaControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsPersonaDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsPersonaDrawerProps {
  activeMessengerThread: boolean;
  model: ChatSettingsPersonaDrawerModel;
  personas: PersonaRecord[];
  onPersonaChange: (personaId: string) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPersonaDrawer({
  activeMessengerThread,
  model,
  personas,
  onPersonaChange,
  onToggle,
}: ChatSettingsPersonaDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="persona"
      open={model.open}
      summary={model.summary}
      title="Persona"
      onToggle={onToggle}
    >
      <ChatSettingsPersonaControls
        activeMessengerThread={activeMessengerThread}
        model={model}
        personas={personas}
        onPersonaChange={onPersonaChange}
      />
    </ChatSettingsDrawer>
  );
}
