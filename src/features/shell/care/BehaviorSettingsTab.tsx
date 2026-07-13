import type { AppSettings, AppSettingsPatch } from "../../../engine/contracts/types/app-settings";
import { MESSENGER, RESERVED, ROLEPLAY } from "../../../engine/contracts/constants/surfaces";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { Switch } from "../../../shared/ui/primitives/Switch";

const SEND_ON_ENTER_SURFACES = [
  { value: ROLEPLAY, label: "Roleplay" },
  { value: MESSENGER, label: "Messenger" },
  { value: RESERVED, label: "Reserved" },
] as const;

interface BehaviorSettingsTabProps {
  settings: Pick<
    AppSettings,
    | "streamReplies"
    | "rippleSpeed"
    | "surfaceAllText"
    | "wheelNavigate"
    | "narrationDrift"
    | "autoplayPause"
    | "sendOnEnterSurface"
    | "confirmRelease"
  >;
  updateAppSettings: (patch: AppSettingsPatch) => void;
  setSendOnEnterSurface: (surface: AppSettings["sendOnEnterSurface"]) => void;
  setConfirmRelease: (confirmRelease: boolean) => void;
}

export function BehaviorSettingsTab({
  settings,
  updateAppSettings,
  setSendOnEnterSurface,
  setConfirmRelease,
}: BehaviorSettingsTabProps) {
  return (
    <>
      <p className="care-intro">How the pond responds to your touch.</p>

      <div className="toggle-row">
        <div className="tl">
          <b>Let replies ripple in</b>
          <i>stream responses word by word</i>
        </div>
        <Switch
          checked={settings.streamReplies}
          onChange={(value) => updateAppSettings({ streamReplies: value })}
          ariaLabel="Let replies ripple in"
        />
      </div>

      <div className="slider-field">
        <div className="sl-top">
          <b>Ripple speed</b>
          <span>{settings.rippleSpeed}</span>
        </div>
        <Slider
          value={settings.rippleSpeed}
          onChange={(value) => updateAppSettings({ rippleSpeed: value })}
          ariaLabel="Ripple speed"
        />
        <div className="track-ends">
          <span>Still</span>
          <span>Rushing</span>
        </div>
      </div>

      <div className="toggle-row">
        <div className="tl">
          <b>Surface all text at once</b>
          <i>skip the reveal, show it all</i>
        </div>
        <Switch
          checked={settings.surfaceAllText}
          onChange={(value) => updateAppSettings({ surfaceAllText: value })}
          ariaLabel="Surface all text at once"
        />
      </div>
      <div className="toggle-row">
        <div className="tl">
          <b>Wheel + click to navigate</b>
          <i>scroll through the depths</i>
        </div>
        <Switch
          checked={settings.wheelNavigate}
          onChange={(value) => updateAppSettings({ wheelNavigate: value })}
          ariaLabel="Wheel + click to navigate"
        />
      </div>

      <div className="slider-field">
        <div className="sl-top">
          <b>Narration drift</b>
          <span>{settings.narrationDrift}</span>
        </div>
        <Slider
          value={settings.narrationDrift}
          onChange={(value) => updateAppSettings({ narrationDrift: value })}
          ariaLabel="Narration drift"
        />
        <div className="track-ends">
          <span>Still</span>
          <span>Rushing</span>
        </div>
      </div>

      <div className="slider-field">
        <div className="sl-top">
          <b>Auto-play pause between segments</b>
          <span>{(settings.autoplayPause / 10).toFixed(1)}s</span>
        </div>
        <Slider
          value={settings.autoplayPause}
          onChange={(value) => updateAppSettings({ autoplayPause: value })}
          ariaLabel="Auto-play pause between segments"
        />
        <div className="track-ends">
          <span>Short</span>
          <span>Long</span>
        </div>
      </div>

      <div className="field">
        <label>Send on Enter</label>
        <div className="help" style={{ marginTop: 0, marginBottom: 10 }}>
          Choose which surface sends when you press Enter.
        </div>
        <Seg
          options={SEND_ON_ENTER_SURFACES}
          value={settings.sendOnEnterSurface}
          onChange={setSendOnEnterSurface}
          ariaLabel="Send on Enter surface"
        />
      </div>

      <div className="toggle-row" style={{ borderBottom: "none" }}>
        <div className="tl">
          <b>Ask before releasing a koi</b>
          <i>confirm before deleting</i>
        </div>
        <Switch
          checked={settings.confirmRelease}
          onChange={setConfirmRelease}
          ariaLabel="Ask before releasing a koi"
        />
      </div>
    </>
  );
}
