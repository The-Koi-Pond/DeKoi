import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import type { ChatSettingsPersonaDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsPersonaControlsProps {
  activeMessengerThread: boolean;
  model: ChatSettingsPersonaDrawerModel;
  personas: PersonaRecord[];
  onPersonaChange: (personaId: string) => void;
}

export function ChatSettingsPersonaControls({
  activeMessengerThread,
  model,
  personas,
  onPersonaChange,
}: ChatSettingsPersonaControlsProps) {
  return (
    <>
      <label className="chat-settings-field">
        <span>Active persona</span>
        <select
          className="pondsel"
          value={model.selectedPersonaId}
          disabled={!activeMessengerThread}
          onChange={(event) => onPersonaChange(event.currentTarget.value)}
        >
          {model.hasMissingPersona && (
            <option value={model.selectedPersonaId}>Missing persona</option>
          )}
          <option value="">Anonymous</option>
          {personas.map((persona) => (
            <option value={persona.id} key={persona.id}>
              {persona.displayName}
            </option>
          ))}
        </select>
      </label>
      {model.hasMissingPersona && (
        <ChatSettingsNotice
          actionLabel="Use Anonymous"
          onAction={() => onPersonaChange("")}
        >
          The selected persona is no longer saved. Choose Anonymous or another
          persona before sending as that identity.
        </ChatSettingsNotice>
      )}
      {activeMessengerThread &&
        personas.length === 0 &&
        !model.hasMissingPersona && (
          <p className="chat-settings-empty-line">
            No personas yet. Messages can still send as Anonymous.
          </p>
        )}
    </>
  );
}
