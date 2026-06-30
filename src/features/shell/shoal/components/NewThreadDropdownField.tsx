import type { ReactNode } from "react";

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
