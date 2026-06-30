import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import { NumberField } from "../../../../shared/ui/primitives/NumberField";
import { Slider } from "../../../../shared/ui/primitives/Slider";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

type AdvancedChatSettings = Pick<
  AppSettings,
  "defaultTemperature" | "defaultMaxTokens" | "defaultTopP"
>;

interface ChatSettingsAdvancedDrawerProps {
  appSettings: AdvancedChatSettings;
  open: boolean;
  settingsLabel: string;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  updateAppSettings: (settings: Partial<AdvancedChatSettings>) => void;
}

export function ChatSettingsAdvancedDrawer({
  appSettings,
  open,
  settingsLabel,
  onToggle,
  updateAppSettings,
}: ChatSettingsAdvancedDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="advanced"
      open={open}
      summary="Temperature and limits"
      title="Advanced Parameters"
      onToggle={onToggle}
    >
      <div className="slider-field">
        <div className="sl-top">
          <b>Temperature</b>
          <span>{(appSettings.defaultTemperature / 100).toFixed(2)}</span>
        </div>
        <Slider
          value={appSettings.defaultTemperature}
          onChange={(value) => updateAppSettings({ defaultTemperature: value })}
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
          <span>{appSettings.defaultMaxTokens}</span>
        </div>
        <NumberField
          value={appSettings.defaultMaxTokens}
          onChange={(value) => updateAppSettings({ defaultMaxTokens: value })}
          min={64}
          max={8192}
          step={64}
          ariaLabel={`${settingsLabel} max tokens`}
        />
      </div>

      <div className="slider-field">
        <div className="sl-top">
          <b>Top-p</b>
          <span>{(appSettings.defaultTopP / 100).toFixed(2)}</span>
        </div>
        <Slider
          value={appSettings.defaultTopP}
          onChange={(value) => updateAppSettings({ defaultTopP: value })}
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
    </ChatSettingsDrawer>
  );
}
