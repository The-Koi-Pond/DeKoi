import type { AppSettings, AppSettingsPatch } from "../../../engine/contracts/types/app-settings";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import { LorebookMultiSelect } from "../../../shared/ui/LorebookMultiSelect";
import { NumberField } from "../../../shared/ui/primitives/NumberField";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { SettingSection } from "./SettingSection";

const LORE_INSERTION_STRATEGIES = [
  { value: "sorted-evenly", label: "Sorted evenly" },
  { value: "character-first", label: "Character first" },
  { value: "global-first", label: "Global first" },
] as const satisfies { value: AppSettings["loreInsertionStrategy"]; label: string }[];

interface GenerationSettingsTabProps {
  settings: Pick<
    AppSettings,
    | "defaultTemperature"
    | "defaultMaxTokens"
    | "defaultTopP"
    | "globalLorebookIds"
    | "loreInsertionStrategy"
  >;
  lorebooks: LorebookRecord[];
  updateAppSettings: (patch: AppSettingsPatch) => void;
}

export function GenerationSettingsTab({
  settings,
  lorebooks,
  updateAppSettings,
}: GenerationSettingsTabProps) {
  return (
    <>
      <p className="care-intro">Default generation parameters for new threads.</p>

      <SettingSection title="Generation" description="Global defaults for model output">
        <div className="slider-field">
          <div className="sl-top">
            <b>Temperature</b>
            <span>{(settings.defaultTemperature / 100).toFixed(2)}</span>
          </div>
          <Slider
            value={settings.defaultTemperature}
            onChange={(value) => updateAppSettings({ defaultTemperature: value })}
            min={0}
            max={200}
            step={5}
            ariaLabel="Temperature"
          />
          <div className="track-ends">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        <div className="slider-field">
          <div className="sl-top">
            <b>Max tokens</b>
            <span>{settings.defaultMaxTokens}</span>
          </div>
          <NumberField
            value={settings.defaultMaxTokens}
            onChange={(value) => updateAppSettings({ defaultMaxTokens: value })}
            min={64}
            max={8192}
            step={64}
            ariaLabel="Max tokens"
          />
        </div>

        <div className="slider-field">
          <div className="sl-top">
            <b>Top-p</b>
            <span>{(settings.defaultTopP / 100).toFixed(2)}</span>
          </div>
          <Slider
            value={settings.defaultTopP}
            onChange={(value) => updateAppSettings({ defaultTopP: value })}
            min={0}
            max={100}
            step={1}
            ariaLabel="Top-p"
          />
          <div className="track-ends">
            <span>Focused</span>
            <span>Diverse</span>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Lorebooks" description="Context added to every generation">
        <LorebookMultiSelect
          emptyMessage="No lorebooks have been created yet."
          fieldClassName="field"
          hintClassName="help"
          idPrefix="care-global-lorebook"
          label="Global lorebooks"
          labelClassName={null}
          lorebooks={lorebooks}
          selectedLorebookIds={settings.globalLorebookIds}
          onChange={(lorebookIds) => updateAppSettings({ globalLorebookIds: lorebookIds })}
        />

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="care-lore-insertion">Insertion strategy</label>
          <select
            className="pondsel"
            id="care-lore-insertion"
            value={settings.loreInsertionStrategy}
            onChange={(event) =>
              updateAppSettings({
                loreInsertionStrategy: event.target.value as AppSettings["loreInsertionStrategy"],
              })
            }
          >
            {LORE_INSERTION_STRATEGIES.map((strategy) => (
              <option key={strategy.value} value={strategy.value}>
                {strategy.label}
              </option>
            ))}
          </select>
        </div>
      </SettingSection>

      <p
        style={{
          color: "var(--mist-dim)",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        These are global defaults. You can override them per thread in the messenger.
      </p>
    </>
  );
}
