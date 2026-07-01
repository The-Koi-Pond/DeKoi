import { ThreadShoalActions } from "./ThreadShoalActions";
import { ThreadShoalSearch } from "./ThreadShoalSearch";
import { ThreadShoalSortControl } from "./ThreadShoalSortControl";

interface ThreadShoalHeadProps {
  activeSurfaceLabel: string;
  isRoleplaySurface: boolean;
  newMessengerOpen: boolean;
  newRoleplayOpen: boolean;
  query: string;
  searchPlaceholder: string;
  sortLabel: string;
  onCreateActiveThread: () => void;
  onCycleSortMode: () => void;
  onQueryChange: (query: string) => void;
}

export function ThreadShoalHead({
  activeSurfaceLabel,
  isRoleplaySurface,
  newMessengerOpen,
  newRoleplayOpen,
  query,
  searchPlaceholder,
  sortLabel,
  onCreateActiveThread,
  onCycleSortMode,
  onQueryChange,
}: ThreadShoalHeadProps) {
  return (
    <>
      <div className="shoal-surface-title">{activeSurfaceLabel}</div>
      <div className="shoal-head">
        <ThreadShoalActions
          isRoleplaySurface={isRoleplaySurface}
          newMessengerOpen={newMessengerOpen}
          newRoleplayOpen={newRoleplayOpen}
          onCreateActiveThread={onCreateActiveThread}
        />
        <ThreadShoalSearch
          query={query}
          searchPlaceholder={searchPlaceholder}
          onQueryChange={onQueryChange}
        />
      </div>
      <ThreadShoalSortControl
        activeSurfaceLabel={activeSurfaceLabel}
        sortLabel={sortLabel}
        onCycleSortMode={onCycleSortMode}
      />
    </>
  );
}
