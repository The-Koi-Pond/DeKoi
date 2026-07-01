interface ThreadShoalSearchProps {
  query: string;
  searchPlaceholder: string;
  onQueryChange: (query: string) => void;
}

export function ThreadShoalSearch({
  query,
  searchPlaceholder,
  onQueryChange,
}: ThreadShoalSearchProps) {
  return (
    <div className="shoal-search">
      <label className="glyph" aria-hidden="true" htmlFor="shoal-search-input">
        ⌕
      </label>
      <input
        id="shoal-search-input"
        type="search"
        placeholder={searchPlaceholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  );
}
