import type { ReactNode } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

interface NewThreadDropdownFieldProps {
  children: ReactNode;
  count: number;
  disabled: boolean;
  label: string;
  labelId: string;
  menuId: string;
  open: boolean;
  selectionLabel: string;
  onOpenChange: (open: boolean) => void;
  onToggleOpenChange?: (open: boolean) => void;
}

export function NewThreadDropdownField({
  children,
  count,
  disabled,
  label,
  labelId,
  menuId,
  open,
  selectionLabel,
  onOpenChange,
  onToggleOpenChange,
}: NewThreadDropdownFieldProps) {
  return (
    <div
      className="new-thread-dropdown-field"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) {
          return;
        }
        onOpenChange(false);
      }}
    >
      <span id={labelId}>{label}</span>
      <button
        type="button"
        className="new-thread-select-button"
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => (onToggleOpenChange ?? onOpenChange)(!open)}
      >
        <span>{selectionLabel}</span>
        <small>{count}</small>
      </button>
      {open && (
        <div
          className="new-thread-select-menu"
          id={menuId}
          role="listbox"
          aria-labelledby={labelId}
          aria-multiselectable="true"
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface NewThreadCharacterOptionProps {
  character: CharacterRecord;
  selected: boolean;
  onToggle: () => void;
}

function NewThreadCharacterOption({
  character,
  selected,
  onToggle,
}: NewThreadCharacterOptionProps) {
  return (
    <label
      className={`new-thread-check${selected ? " on" : ""}`}
      role="option"
      aria-selected={selected}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} />
      <span>
        <b>{character.displayName}</b>
        <small>{character.nickname || character.personality || "Companion"}</small>
      </span>
    </label>
  );
}

interface NewThreadCharacterDropdownProps {
  characters: CharacterRecord[];
  emptyMessage: string;
  labelId: string;
  menuId: string;
  open: boolean;
  selectedIds: string[];
  selectionLabel: string;
  onOpenChange: (open: boolean) => void;
  onToggleOpenChange?: (open: boolean) => void;
  onToggleCharacter: (characterId: string) => void;
}

export function NewThreadCharacterDropdown({
  characters,
  emptyMessage,
  labelId,
  menuId,
  open,
  selectedIds,
  selectionLabel,
  onOpenChange,
  onToggleOpenChange,
  onToggleCharacter,
}: NewThreadCharacterDropdownProps) {
  return (
    <>
      <NewThreadDropdownField
        count={selectedIds.length}
        disabled={characters.length === 0}
        label="Companions"
        labelId={labelId}
        menuId={menuId}
        open={open}
        selectionLabel={selectionLabel}
        onOpenChange={onOpenChange}
        onToggleOpenChange={onToggleOpenChange}
      >
        {characters.map((character) => (
          <NewThreadCharacterOption
            character={character}
            key={character.id}
            selected={selectedIds.includes(character.id)}
            onToggle={() => onToggleCharacter(character.id)}
          />
        ))}
      </NewThreadDropdownField>
      {characters.length === 0 && (
        <p className="new-thread-empty">{emptyMessage}</p>
      )}
    </>
  );
}

interface NewThreadLorebookDropdownProps {
  labelId: string;
  lorebooks: LorebookRecord[];
  menuId: string;
  open: boolean;
  selectedIds: string[];
  selectionLabel: string;
  onOpenChange: (open: boolean) => void;
  onToggleOpenChange?: (open: boolean) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function NewThreadLorebookDropdown({
  labelId,
  lorebooks,
  menuId,
  open,
  selectedIds,
  selectionLabel,
  onOpenChange,
  onToggleOpenChange,
  onToggleLorebook,
}: NewThreadLorebookDropdownProps) {
  return (
    <NewThreadDropdownField
      count={selectedIds.length}
      disabled={lorebooks.length === 0}
      label="Lorebooks"
      labelId={labelId}
      menuId={menuId}
      open={open}
      selectionLabel={selectionLabel}
      onOpenChange={onOpenChange}
      onToggleOpenChange={onToggleOpenChange}
    >
      {lorebooks.map((lorebook) => {
        const selected = selectedIds.includes(lorebook.id);

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
    </NewThreadDropdownField>
  );
}
