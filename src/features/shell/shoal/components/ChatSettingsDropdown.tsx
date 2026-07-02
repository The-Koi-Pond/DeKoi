import { useId, useMemo, useState } from "react";

export interface ChatSettingsDropdownOption {
  disabled?: boolean;
  label: string;
  value: string;
}

interface ChatSettingsDropdownProps {
  disabled?: boolean;
  labelledBy: string;
  menuId?: string;
  options: ChatSettingsDropdownOption[];
  value: string;
  onChange: (value: string) => void;
}

export function ChatSettingsDropdown({
  disabled = false,
  labelledBy,
  menuId,
  options,
  value,
  onChange,
}: ChatSettingsDropdownProps) {
  const fallbackId = useId();
  const resolvedMenuId = menuId ?? `${fallbackId}-menu`;
  const [open, setOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0] ?? null;
  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );

  function close() {
    setOpen(false);
  }

  function selectValue(nextValue: string) {
    onChange(nextValue);
    close();
  }

  function stepSelection(direction: 1 | -1) {
    if (enabledOptions.length === 0) return;

    const currentIndex = enabledOptions.findIndex(
      (option) => option.value === value,
    );
    const fallbackIndex = direction === 1 ? 0 : enabledOptions.length - 1;
    const nextIndex =
      currentIndex === -1
        ? fallbackIndex
        : (currentIndex + direction + enabledOptions.length) %
          enabledOptions.length;

    onChange(enabledOptions[nextIndex].value);
  }

  return (
    <div
      className={`chat-settings-dropdown-control${open ? " open" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) {
          return;
        }
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
          stepSelection(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
          stepSelection(-1);
        }
      }}
    >
      <button
        type="button"
        className="chat-settings-select-button"
        aria-controls={resolvedMenuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? "Choose"}</span>
      </button>
      {open && !disabled && (
        <div
          className="chat-settings-select-menu"
          id={resolvedMenuId}
          role="listbox"
          aria-labelledby={labelledBy}
        >
          {options.map((option) => (
            <button
              type="button"
              className={`chat-settings-option${
                option.value === value ? " on" : ""
              }`}
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectValue(option.value)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
