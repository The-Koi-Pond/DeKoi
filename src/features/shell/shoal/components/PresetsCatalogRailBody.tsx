import { PromptPresetFileActions, RestoreStarterPresetAction } from "../../../catalog";
import { getMessengerThreadInitials } from "../../../modes";
import type { ShoalNav } from "../types";
import { CatalogRailCard } from "./CatalogRailCard";

type PresetsCatalogRailBodyProps = {
  originActive: boolean;
  nav: Pick<
    ShoalNav,
    | "exportPromptPresetFile"
    | "importPromptPresetFile"
    | "openPromptPresetFile"
    | "promptPresetFileHost"
    | "promptPresetFileStatus"
    | "promptPresets"
    | "restoreStarterPromptPreset"
    | "sideRailView"
    | "setPromptPresetFileStatus"
    | "setView"
    | "view"
  >;
};

export function PresetsCatalogRailBody({ nav, originActive }: PresetsCatalogRailBodyProps) {
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
      {nav.view.kind !== "presets" && (
        <>
          <RestoreStarterPresetAction
            restoreStarterPromptPreset={nav.restoreStarterPromptPreset}
            setPromptPresetCatalogStatus={nav.setPromptPresetFileStatus}
            navigationContext={nav.view}
            sideRailView={nav.sideRailView}
            originActive={originActive}
            onRestoredPresetReady={(presetId) => nav.setView({ kind: "presets", presetId })}
          />
          <PromptPresetFileActions
            visibility="list"
            host={nav.promptPresetFileHost}
            importPromptPresetFile={nav.importPromptPresetFile}
            openPromptPresetFile={nav.openPromptPresetFile}
            exportPromptPresetFile={nav.exportPromptPresetFile}
            navigationContext={nav.view}
            sideRailView={nav.sideRailView}
            originActive={originActive}
            status={nav.promptPresetFileStatus}
            onImportedPresetReady={(presetId) => nav.setView({ kind: "presets", presetId })}
            onStatusChange={nav.setPromptPresetFileStatus}
          />
        </>
      )}
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
