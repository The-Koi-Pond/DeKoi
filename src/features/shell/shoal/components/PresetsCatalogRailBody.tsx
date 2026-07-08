import { getMessengerThreadInitials } from "../../../modes";
import type { ShoalNav } from "../types";
import { CatalogRailCard } from "./CatalogRailCard";

type PresetsCatalogRailBodyProps = {
  nav: Pick<ShoalNav, "promptPresets" | "setView" | "view">;
};

export function PresetsCatalogRailBody({ nav }: PresetsCatalogRailBodyProps) {
  const activePresetId = nav.view.kind === "presets" ? (nav.view.presetId ?? null) : null;
  const presetCount = nav.promptPresets.length;

  return (
    <>
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <span className="shoal-symbol" aria-hidden="true">
              ≡
            </span>
            Presets
          </h2>
          <span className="count">{presetCount} stocked</span>
        </div>
        <div className="shoal-actions">
          <button
            className="pill koi"
            type="button"
            onClick={() => nav.setView({ kind: "presets", mode: "new" })}
          >
            ＋ Preset
          </button>
        </div>
      </div>
      <div className="shoal-meta">
        <span>Presets</span>
        <span className="mark-chip">{presetCount} shown</span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Presets</div>
        {nav.promptPresets.map((preset) => (
          <CatalogRailCard
            key={preset.id}
            active={preset.id === activePresetId}
            initials={getMessengerThreadInitials(preset.title)}
            name={preset.title}
            sub={preset.summary || "No summary yet."}
            tone="amber"
            onOpen={() => nav.setView({ kind: "presets", presetId: preset.id })}
          />
        ))}
        {nav.promptPresets.length === 0 && (
          <div className="shoal-empty">
            <p>No presets yet.</p>
            <button type="button" onClick={() => nav.setView({ kind: "presets", mode: "new" })}>
              ＋ Preset
            </button>
          </div>
        )}
      </div>
    </>
  );
}
