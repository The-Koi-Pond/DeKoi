import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsDropdown, type ChatSettingsDropdownOption } from "./ChatSettingsDropdown";
import type { ChatSettingsPersonaDrawerModel } from "../lib/chat-settings-identity-drawer-models";

interface ChatSettingsPersonaControlsProps {
  model: ChatSettingsPersonaDrawerModel;
  personas: PersonaRecord[];
  onPersonaChange: (personaId: string) => void;
}

export function ChatSettingsPersonaControls({
  model,
  personas,
  onPersonaChange,
}: ChatSettingsPersonaControlsProps) {
  const options: ChatSettingsDropdownOption[] = [
    ...(model.hasMissingPersona
      ? [
          {
            disabled: true,
            label: "Missing persona",
            value: model.selectedPersonaId,
          },
        ]
      : []),
    { label: "Anonymous", value: "" },
    ...personas.map((persona) => ({
      label: persona.displayName,
      value: persona.id,
    })),
  ];

  return (
    <>
      <div className="chat-settings-field chat-settings-dropdown-field">
        <span id="chat-settings-persona-label">Active persona</span>
        <ChatSettingsDropdown
          value={model.selectedPersonaId}
          labelledBy="chat-settings-persona-label"
          menuId="chat-settings-persona-menu"
          options={options}
          disabled={!model.activeMessengerThread}
          onChange={onPersonaChange}
        />
      </div>
      {model.hasMissingPersona && (
        <ChatSettingsNotice actionLabel="Use Anonymous" onAction={() => onPersonaChange("")}>
          The selected persona is no longer saved. Choose Anonymous or another persona before
          sending as that identity.
        </ChatSettingsNotice>
      )}
      {model.activeMessengerThread && personas.length === 0 && !model.hasMissingPersona && (
        <p className="chat-settings-empty-line">
          No personas yet. Messages can still send as Anonymous.
        </p>
      )}
    </>
  );
}
