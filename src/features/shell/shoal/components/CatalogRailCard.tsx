interface CatalogRailCardProps {
  active?: boolean;
  avatarUrl?: string | null;
  initials: string;
  name: string;
  onOpen: () => void;
  sub: string;
  tone: "koi" | "jade" | "amber";
}

export function CatalogRailCard({
  active,
  avatarUrl,
  initials,
  name,
  onOpen,
  sub,
  tone,
}: CatalogRailCardProps) {
  return (
    <button
      type="button"
      className={`catalog-rail-card ${tone}${active ? " on" : ""}`}
      onClick={onOpen}
    >
      <span className="catalog-rail-ava">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
      </span>
      <span className="catalog-rail-copy">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}
