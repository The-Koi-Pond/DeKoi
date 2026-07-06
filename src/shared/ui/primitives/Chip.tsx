/**
 * Single-select pill group (Chip). Renders `.chips` / `.chip(.on)`.
 * Mirrors `Seg` API — pass `options`, `value`, `onChange`, and `ariaLabel`.
 */
interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipProps<T extends string> {
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function Chip<T extends string>({ options, value, onChange, ariaLabel }: ChipProps<T>) {
  return (
    <div className="chips" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <div
            key={opt.value}
            className={`chip${selected ? " on" : ""}`}
            data-accent={opt.value}
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
