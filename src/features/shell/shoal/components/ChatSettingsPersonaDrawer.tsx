import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { ChatSettingsDrawer, ChatSettingsNotice } from "./ChatSettingsBlocks";
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
      <label className="chat-settings-field">
        <span>Active persona</span>
        <select
          className="pondsel"
          value={selectedPersonaId}
          disabled={!activeMessengerThread}
          onChange={(event) => onPersonaChange(event.currentTarget.value)}
        >
          {hasMissingPersona && (
            <option value={selectedPersonaId}>Missing persona</option>
          )}
          <option value="">Anonymous</option>
          {personas.map((persona) => (
            <option value={persona.id} key={persona.id}>
              {persona.displayName}
            </option>
          ))}
        </select>
      </label>
      {hasMissingPersona && (
        <ChatSettingsNotice
          actionLabel="Use Anonymous"
          onAction={() => onPersonaChange("")}
        >
          The selected persona is no longer saved. Choose Anonymous or another
          persona before sending as that identity.
        </ChatSettingsNotice>
      )}
      {activeMessengerThread && personas.length === 0 && !hasMissingPersona && (
        <p className="chat-settings-empty-line">
          No personas yet. Messages can still send as Anonymous.
        </p>
      )}
    </ChatSettingsDrawer>
  );
}
