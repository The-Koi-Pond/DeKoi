import type { AppSettings, AppSettingsPatch } from "../../../engine/contracts/types/app-settings";
import { Chip } from "../../../shared/ui/primitives/Chip";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { SettingSection } from "./SettingSection";

interface AppearanceSettingsTabProps {
  settings: Pick<AppSettings, "accent" | "motion" | "density" | "fontScale">;
  updateAppSettings: (patch: AppSettingsPatch) => void;
}

export function AppearanceSettingsTab({ settings, updateAppSettings }: AppearanceSettingsTabProps) {
  return (
    <>
      <p className="care-intro">Change how the pond looks. Changes apply instantly.</p>

      <SettingSection title="Accent">
        <Chip
          options={[
            { value: "koi", label: "Koi" },
            { value: "jade", label: "Jade" },
            { value: "amber", label: "Amber" },
          ]}
          value={settings.accent}
          onChange={(value) => updateAppSettings({ accent: value })}
          ariaLabel="Accent color"
        />
      </SettingSection>

      <SettingSection title="Motion">
        <Seg
          options={[
            { value: "auto", label: "Auto" },
            { value: "reduced", label: "Reduced" },
            { value: "off", label: "Off" },
          ]}
          value={settings.motion}
          onChange={(value) => updateAppSettings({ motion: value })}
          ariaLabel="Motion preference"
        />
        <div className="help" style={{ marginTop: 0 }}>
          Auto follows your system&rsquo;s reduced-motion setting.
        </div>
      </SettingSection>

      <SettingSection title="Density">
        <Seg
          options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
          ]}
          value={settings.density}
          onChange={(value) => updateAppSettings({ density: value })}
          ariaLabel="Density preference"
        />
      </SettingSection>

      <SettingSection title="Text size">
        <Slider
          value={settings.fontScale}
          onChange={(value) => updateAppSettings({ fontScale: value })}
          ariaLabel="Text size"
          min={90}
          max={120}
          step={5}
        />
        <div className="track-ends">
          <span>Small</span>
          <span>Large</span>
        </div>
      </SettingSection>
    </>
  );
}
