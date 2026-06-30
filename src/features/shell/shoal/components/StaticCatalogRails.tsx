import { ShoalTopBar } from "./ShoalTopBar";

interface StaticCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: {
    selectedSurface: string;
  };
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function MediaCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: StaticCatalogRailProps) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — media">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <div className="shoal-head">
          <div className="shoal-title">
            <h2>
              <span className="shoal-symbol" aria-hidden="true">
                ◐
              </span>
              Media
            </h2>
          </div>
        </div>
        <div className="shoal-meta">
          <span>Assets</span>
        </div>
        <div className="shoal-list">
          <div className="shoal-empty">
            <p>No media assets yet.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function PresetsCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: StaticCatalogRailProps) {
  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — presets">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <div className="shoal-head">
          <div className="shoal-title">
            <h2>
              <span className="shoal-symbol" aria-hidden="true">
                ≡
              </span>
              Presets
            </h2>
            <span className="count">0 stocked</span>
          </div>
        </div>
        <div className="shoal-meta">
          <span>Presets</span>
          <span className="mark-chip">0 shown</span>
        </div>
        <div className="shoal-list">
          <div className="group-label">Presets</div>
          <div className="shoal-empty">
            <p>No presets yet.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
