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
