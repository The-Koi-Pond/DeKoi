import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsPersonaControls } from "./ChatSettingsPersonaControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsPersonaDrawerProps {
  activeMessengerThread: boolean;
  hasMissingPersona: boolean;
  open: boolean;
  personas: PersonaRecord[];
  selectedPersonaId: string;
  summary: string;
  onPersonaChange: (personaId: string) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsPersonaDrawer({
  activeMessengerThread,
  hasMissingPersona,
  open,
  personas,
  selectedPersonaId,
  summary,
  onPersonaChange,
  onToggle,
}: ChatSettingsPersonaDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="persona"
      open={open}
      summary={summary}
      title="Persona"
      onToggle={onToggle}
    >
      <ChatSettingsPersonaControls
        activeMessengerThread={activeMessengerThread}
        hasMissingPersona={hasMissingPersona}
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onPersonaChange={onPersonaChange}
      />
    </ChatSettingsDrawer>
  );
}
