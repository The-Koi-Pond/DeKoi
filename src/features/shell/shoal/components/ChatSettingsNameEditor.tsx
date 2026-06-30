import type { FormEvent, KeyboardEvent } from "react";

interface ChatSettingsNameEditorProps {
  activeChatName: string;
  disabled: boolean;
  editing: boolean;
  value: string;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  onValueChange: (value: string) => void;
}

export function ChatSettingsNameEditor({
  activeChatName,
  disabled,
  editing,
  value,
  onCancel,
  onSave,
  onStartEdit,
  onValueChange,
}: ChatSettingsNameEditorProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="chat-name-field">
      <span>Chat Name</span>
      {editing && !disabled ? (
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            value={value}
            onBlur={onSave}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </form>
      ) : (
        <button type="button" disabled={disabled} onClick={onStartEdit}>
          {disabled ? "No active chat" : activeChatName}
        </button>
      )}
    </div>
  );
}
