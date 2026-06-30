import type { FormEvent } from "react";

interface ChatSettingsPromptEditorProps {
  open: boolean;
  value: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
}

export function ChatSettingsPromptEditor({
  open,
  value,
  onClose,
  onSave,
  onValueChange,
}: ChatSettingsPromptEditorProps) {
  if (!open) return null;

  return (
    <div
      className="prompt-editor-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <form
        className="prompt-editor-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="messenger-prompt-editor-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSave}
      >
        <div className="prompt-editor-head">
          <b id="messenger-prompt-editor-title">Messenger System Prompt</b>
          <button
            type="button"
            aria-label="Close system prompt editor"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label className="prompt-editor-field">
          <span>Prompt text</span>
          <textarea
            autoFocus
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
          />
        </label>
        <div className="prompt-editor-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
