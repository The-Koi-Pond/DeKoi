import type { FormEventHandler } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";

interface NewRoleplayThreadPopoverProps {
  characterIds: string[];
  characters: CharacterRecord[];
  companionLabel: string;
  companionMenuOpen: boolean;
  connectionId: string;
  connections: ProviderConnectionRecord[];
  lorebookIds: string[];
  lorebookLabel: string;
  lorebookMenuOpen: boolean;
  lorebooks: LorebookRecord[];
  name: string;
  namePlaceholder: string;
  personaId: string;
  personas: PersonaRecord[];
  onClose: () => void;
  onCompanionMenuOpenChange: (open: boolean) => void;
  onConnectionChange: (connectionId: string) => void;
  onLorebookMenuOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onPersonaChange: (personaId: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggleCharacter: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function NewRoleplayThreadPopover({
  characterIds,
  characters,
  companionLabel,
  companionMenuOpen,
  connectionId,
  connections,
  lorebookIds,
  lorebookLabel,
  lorebookMenuOpen,
  lorebooks,
  name,
  namePlaceholder,
  personaId,
  personas,
  onClose,
  onCompanionMenuOpenChange,
  onConnectionChange,
  onLorebookMenuOpenChange,
  onNameChange,
  onPersonaChange,
  onSubmit,
  onToggleCharacter,
  onToggleLorebook,
}: NewRoleplayThreadPopoverProps) {
  return (
    <div className="new-thread-backdrop" role="presentation" onClick={onClose}>
      <form
        className="new-thread-popover"
        id="new-roleplay-thread-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-roleplay-thread-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="new-thread-popover-head">
          <b id="new-roleplay-thread-title">New Roleplay Thread</b>
          <button
            type="button"
            aria-label="Close new Roleplay thread"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label className="new-thread-field">
          <span>Thread Name</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={namePlaceholder}
          />
        </label>
        <label className="new-thread-field">
          <span>Connection</span>
          <select
            value={connectionId}
            onChange={(event) => onConnectionChange(event.target.value)}
            disabled={connections.length === 0}
          >
            {connections.map((connection) => (
              <option value={connection.id} key={connection.id}>
                {connection.label}
              </option>
            ))}
          </select>
        </label>
        <label className="new-thread-field">
          <span>Persona</span>
          <select
            value={personaId}
            onChange={(event) => onPersonaChange(event.target.value)}
          >
            <option value="">No persona</option>
            {personas.map((persona) => (
              <option value={persona.id} key={persona.id}>
                {persona.displayName}
              </option>
            ))}
          </select>
        </label>
        <div
          className="new-thread-dropdown-field"
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            onCompanionMenuOpenChange(false);
          }}
        >
          <span id="new-roleplay-companions-label">Companions</span>
          <button
            type="button"
            className="new-thread-select-button"
            aria-controls="new-roleplay-companion-menu"
            aria-expanded={companionMenuOpen}
            aria-haspopup="listbox"
            aria-labelledby="new-roleplay-companions-label"
            disabled={characters.length === 0}
            onClick={() => {
              onLorebookMenuOpenChange(false);
              onCompanionMenuOpenChange(!companionMenuOpen);
            }}
          >
            <span>{companionLabel}</span>
            <small>{characterIds.length}</small>
          </button>
          {companionMenuOpen && (
            <div
              className="new-thread-select-menu"
              id="new-roleplay-companion-menu"
              role="listbox"
              aria-labelledby="new-roleplay-companions-label"
              aria-multiselectable="true"
            >
              {characters.map((character) => {
                const selected = characterIds.includes(character.id);

                return (
                  <label
                    className={`new-thread-check${selected ? " on" : ""}`}
                    key={character.id}
                    role="option"
                    aria-selected={selected}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleCharacter(character.id)}
                    />
                    <span>
                      <b>{character.displayName}</b>
                      <small>
                        {character.nickname ||
                          character.personality ||
                          "Companion"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {characters.length === 0 && (
            <p className="new-thread-empty">
              Add a companion before starting a Roleplay thread.
            </p>
          )}
        </div>
        <div
          className="new-thread-dropdown-field"
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            onLorebookMenuOpenChange(false);
          }}
        >
          <span id="new-roleplay-lorebooks-label">Lorebooks</span>
          <button
            type="button"
            className="new-thread-select-button"
            aria-controls="new-roleplay-lorebook-menu"
            aria-expanded={lorebookMenuOpen}
            aria-haspopup="listbox"
            aria-labelledby="new-roleplay-lorebooks-label"
            disabled={lorebooks.length === 0}
            onClick={() => {
              onCompanionMenuOpenChange(false);
              onLorebookMenuOpenChange(!lorebookMenuOpen);
            }}
          >
            <span>{lorebookLabel}</span>
            <small>{lorebookIds.length}</small>
          </button>
          {lorebookMenuOpen && (
            <div
              className="new-thread-select-menu"
              id="new-roleplay-lorebook-menu"
              role="listbox"
              aria-labelledby="new-roleplay-lorebooks-label"
              aria-multiselectable="true"
            >
              {lorebooks.map((lorebook) => {
                const selected = lorebookIds.includes(lorebook.id);

                return (
                  <label
                    className={`new-thread-check${selected ? " on" : ""}`}
                    key={lorebook.id}
                    role="option"
                    aria-selected={selected}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleLorebook(lorebook.id)}
                    />
                    <span>
                      <b>{lorebook.title}</b>
                      <small>{lorebook.summary || "Lorebook"}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="new-thread-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={characterIds.length === 0}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
