interface ThreadShoalSortControlProps {
  activeSurfaceLabel: string;
  sortLabel: string;
  onCycleSortMode: () => void;
}

export function ThreadShoalSortControl({
  activeSurfaceLabel,
  sortLabel,
  onCycleSortMode,
}: ThreadShoalSortControlProps) {
  return (
    <div className="shoal-meta">
      <button
        type="button"
        className="sort"
        aria-label={`Sort ${activeSurfaceLabel} threads: ${sortLabel}`}
        title="Change thread sort"
        onClick={onCycleSortMode}
      >
        ↕ {sortLabel}
      </button>
    </div>
  );
}
