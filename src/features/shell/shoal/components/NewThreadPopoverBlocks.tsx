import type { FormEventHandler, ReactNode } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

interface NewThreadPopoverFrameProps {
  children: ReactNode;
  closeLabel: string;
  id: string;
  title: string;
  titleId: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function NewThreadPopoverFrame({
  children,
  closeLabel,
  id,
  title,
  titleId,
  onClose,
  onSubmit,
}: NewThreadPopoverFrameProps) {
  return (
    <div className="new-thread-backdrop" role="presentation" onClick={onClose}>
      <form
        className="new-thread-popover"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="new-thread-popover-head">
          <b id={titleId}>{title}</b>
          <button type="button" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}

interface NewThreadTextFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function NewThreadTextField({
  label,
  placeholder,
  value,
  onChange,
}: NewThreadTextFieldProps) {
  return (
    <label className="new-thread-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

interface NewThreadSelectFieldProps {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function NewThreadSelectField({
  children,
  disabled = false,
  label,
  value,
  onChange,
}: NewThreadSelectFieldProps) {
  return (
    <label className="new-thread-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

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

interface NewThreadActionsProps {
  submitDisabled: boolean;
  onClose: () => void;
}

export function NewThreadActions({
  submitDisabled,
  onClose,
}: NewThreadActionsProps) {
  return (
    <div className="new-thread-actions">
      <button type="button" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" disabled={submitDisabled}>
        Create
      </button>
    </div>
  );
}
