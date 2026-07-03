import {
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEventHandler,
} from "react";
import "./chat-composer.css";

interface ChatComposerProps {
  ariaLabel: string;
  draftAriaLabel: string;
  disabled: boolean;
  hint: string;
  isSubmitting?: boolean;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onSubmit: () => void;
  placeholder: string;
  submitBusyLabel?: string;
  submitLabel: string;
  value: string;
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12 20 5l-5.5 14-3.1-5.7L4 12Z" />
      <path d="m11.4 13.3 3.3-3.7" />
    </svg>
  );
}

export function ChatComposer({
  ariaLabel,
  draftAriaLabel,
  disabled,
  hint,
  isSubmitting = false,
  onChange,
  onKeyDown,
  onSubmit,
  placeholder,
  submitBusyLabel,
  submitLabel,
  value,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = `${ariaLabel.replace(/\s+/g, "-").toLowerCase()}-hint`;
  const effectiveSubmitLabel = isSubmitting && submitBusyLabel ? submitBusyLabel : submitLabel;

  function resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }

  useEffect(() => {
    if (!textareaRef.current) return;
    resizeTextarea(textareaRef.current);
  }, [value]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isSubmitting) return;
    onSubmit();
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    resizeTextarea(event.target);
    onChange(event.target.value);
  }

  return (
    <form
      className="chat-composer"
      aria-label={ariaLabel}
      aria-describedby={hintId}
      onSubmit={handleSubmit}
    >
      <textarea
        ref={textareaRef}
        className="chat-composer-input"
        aria-label={draftAriaLabel}
        autoCapitalize="sentences"
        autoCorrect="on"
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        spellCheck
        value={value}
      />
      <button
        type="submit"
        className="chat-composer-send"
        aria-label={effectiveSubmitLabel}
        disabled={disabled || isSubmitting}
        title={effectiveSubmitLabel}
      >
        <SendIcon />
      </button>
      <p id={hintId} className="chat-composer-hint">
        {hint}
      </p>
    </form>
  );
}
