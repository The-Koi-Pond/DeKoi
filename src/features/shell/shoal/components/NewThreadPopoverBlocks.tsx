import type { FormEventHandler, ReactNode } from "react";

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
