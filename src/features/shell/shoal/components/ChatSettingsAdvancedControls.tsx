import { NumberField } from "../../../../shared/ui/primitives/NumberField";
import { Slider } from "../../../../shared/ui/primitives/Slider";
import type {
  AdvancedChatSettings,
  ChatSettingsAdvancedDrawerModel,
} from "../lib/chat-settings-advanced-drawer-models";

interface ChatSettingsAdvancedControlsProps {
  model: ChatSettingsAdvancedDrawerModel;
  onUpdateAppSettings: (settings: Partial<AdvancedChatSettings>) => void;
}

export function ChatSettingsAdvancedControls({
  model,
  onUpdateAppSettings,
}: ChatSettingsAdvancedControlsProps) {
  const { settings, settingsLabel } = model;

  return (
    <>
      <div className="slider-field">
        <div className="sl-top">
          <b>Temperature</b>
          <span>{(settings.defaultTemperature / 100).toFixed(2)}</span>
        </div>
        <Slider
          value={settings.defaultTemperature}
          onChange={(value) => onUpdateAppSettings({ defaultTemperature: value })}
          min={0}
          max={200}
          step={5}
          ariaLabel={`${settingsLabel} temperature`}
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
          onChange={(value) => onUpdateAppSettings({ defaultMaxTokens: value })}
          min={64}
          max={8192}
          step={64}
          ariaLabel={`${settingsLabel} max tokens`}
        />
      </div>

      <div className="slider-field">
        <div className="sl-top">
          <b>Top-p</b>
          <span>{(settings.defaultTopP / 100).toFixed(2)}</span>
        </div>
        <Slider
          value={settings.defaultTopP}
          onChange={(value) => onUpdateAppSettings({ defaultTopP: value })}
          min={0}
          max={100}
          step={1}
          ariaLabel={`${settingsLabel} top-p`}
        />
        <div className="track-ends">
          <span>Focused</span>
          <span>Diverse</span>
        </div>
      </div>
    </>
  );
}
