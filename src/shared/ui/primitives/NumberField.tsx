import { useState } from "react";

/**
 * Controlled number input. Renders an `<input type="number">` styled via the
 * `.pondinput` class from care-fields.css.
 *
 * Uses a local draft string during editing so that intermediate keystrokes
 * (e.g. typing "5" when min=64) aren't instantly clamped. The final value is
 * parsed, clamped, and committed on blur or Enter.
 */
interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function NumberField({ value, onChange, min, max, step = 1, ariaLabel }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep the draft in sync when value changes from outside this field
  // (e.g. a bundle import overwriting appSettings). Uses the
  // adjust-state-during-render pattern rather than an effect, so the input
  // never shows a stale value after an external change.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  function commit() {
    const raw = parseInt(draft, 10);
    if (!isNaN(raw)) {
      const clamped = clamp(raw, min, max);
      onChange(clamped);
      setDraft(String(clamped));
    } else {
      // Revert to last valid value without calling onChange.
      setDraft(String(value));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <input
      type="number"
      className="pondinput"
      value={draft}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
    />
  );
}
