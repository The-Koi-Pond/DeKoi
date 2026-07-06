/**
 * Segmented single-select. Renders `.seg` / `.seg .opt(.on)` from
 * care-fields.css. Controlled: pass `value` and `onChange`.
 */
interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface SegProps<T extends string> {
  options: ReadonlyArray<SegOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function Seg<T extends string>({ options, value, onChange, ariaLabel }: SegProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <div
            key={opt.value}
            className={`opt${selected ? " on" : ""}`}
            role="radio"
            tabIndex={selected ? 0 : -1}
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onChange(opt.value);
              }
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}
