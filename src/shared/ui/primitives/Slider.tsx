import { useCallback, useRef } from "react";

/**
 * Pointer-draggable slider. Renders `.track` / `.fill` / `.knob` from
 * care-fields.css. Controlled: pass `value` (within [min,max]) and `onChange`.
 * Supports drag (pointer events) and keyboard (arrows, Home/End).
 */
interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  step?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function Slider({ value, onChange, ariaLabel, min = 0, max = 100, step = 1 }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + pct * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(clamp(stepped, min, max));
    },
    [min, max, step, onChange],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    let next: number;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = value - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = value + step;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(clamp(next, min, max));
  }

  function handlePointerDown(e: React.PointerEvent) {
    setFromClientX(e.clientX);
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      className="track"
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <div className="fill" style={{ width: `${pct}%` }} />
      <div className="knob" style={{ left: `${pct}%` }} />
    </div>
  );
}
