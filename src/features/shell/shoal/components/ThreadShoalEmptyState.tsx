interface ThreadShoalEmptyStateProps {
  isRoleplaySurface: boolean;
  onCreateActiveThread: () => void;
}

export function ThreadShoalEmptyState({
  isRoleplaySurface,
  onCreateActiveThread,
}: ThreadShoalEmptyStateProps) {
  return (
    <div className="shoal-empty">
      <p>No saved currents match this search.</p>
      <button type="button" onClick={onCreateActiveThread}>
        {isRoleplaySurface ? "Start roleplay" : "Cast a line"}
      </button>
    </div>
  );
}
