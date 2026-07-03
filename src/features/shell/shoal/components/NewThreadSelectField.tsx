import type { ReactNode } from "react";

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
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}
