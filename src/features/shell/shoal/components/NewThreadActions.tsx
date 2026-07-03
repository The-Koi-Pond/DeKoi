interface NewThreadActionsProps {
  submitDisabled: boolean;
  onClose: () => void;
}

export function NewThreadActions({ submitDisabled, onClose }: NewThreadActionsProps) {
  return (
    <div className="new-thread-actions">
      <button type="button" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" disabled={submitDisabled}>
        Create
      </button>
    </div>
  );
}
