import { useState, type FormEvent } from "react";
import type { NavContextType } from "../../../shared/ui/nav-context";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { checkRemoteRuntimeHealth } from "../../../runtime/remote-runtime";
import "./CareDrawer.css";
import "./care-fields.css";

interface CareDrawerProps {
  nav: NavContextType;
}

// Tab labels + their short descriptor. Other than "Water", every tab renders a
// "coming soon" placeholder — the visible labels still describe the intent.
const CARE_TABS = [
  { label: "Water", hint: "general" },
  { label: "Light", hint: "look" },
  { label: "Season", hint: "themes" },
  { label: "Habitat", hint: "modules" },
  { label: "Companions", hint: "extensions" },
  { label: "Stocking", hint: "import" },
  { label: "Vitals", hint: "health" },
  { label: "Deep water", hint: "advanced" },
] as const;

// DeKoi-native surface ids for the Send-on-Enter segmented control.
const SEND_ON_ENTER_SURFACES = [
  { value: "vn", label: "VN" },
  { value: "bubbles", label: "Bubbles" },
  { value: "reserved", label: "Reserved" },
] as const;

export function CareDrawer({ nav }: CareDrawerProps) {
  const open = nav.careOpen;

  // Local-only settings state. These are intentionally not persisted yet —
  // they prove the controls work; a settings store comes later. The two with
  // real product meaning (sendOnEnter, confirmRelease) are wired read/write.
  const [streamReplies, setStreamReplies] = useState(true);
  const [spotifyPlayer, setSpotifyPlayer] = useState(false);
  const [rippleSpeed, setRippleSpeed] = useState(50);
  const [surfaceAllText, setSurfaceAllText] = useState(false);
  const [wheelNavigate, setWheelNavigate] = useState(false);
  const [narrationDrift, setNarrationDrift] = useState(50);
  const [autoplayPause, setAutoplayPause] = useState(30);
  const [sendOnEnter, setSendOnEnter] = useState<string>("bubbles");
  const [confirmRelease, setConfirmRelease] = useState(true);
  const [runtimeUrl, setRuntimeUrl] = useState(nav.remoteRuntimeUrl);
  const [runtimeHealth, setRuntimeHealth] = useState("");
  const runtimeStatusMessage = runtimeHealth || nav.bubbleStorageMessage;

  function handleRuntimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuntimeHealth("");
    nav.setRemoteRuntimeUrl(runtimeUrl);
  }

  async function handleRuntimeTest() {
    setRuntimeHealth("Checking remote runtime...");
    const health = await checkRemoteRuntimeHealth(runtimeUrl);
    setRuntimeHealth(health.message);
  }

  function handleUseLocalStorage() {
    setRuntimeUrl("");
    nav.setRemoteRuntimeUrl("");
    setRuntimeHealth("Saved locally.");
  }

  return (
    <>
      <div
        className={`scrim${open ? " open" : ""}`}
        onClick={() => nav.setCareOpen(false)}
        aria-hidden={open ? undefined : true}
      />
      <aside
        className={`care${open ? " open" : ""}`}
        aria-label="Pond Care"
        aria-hidden={open ? undefined : true}
      >
        <div className="care-head">
          <div className="top">
            <img src="/koi-mark.svg" alt="" style={{ width: 26, height: 26 }} />
            <h2>Pond Care</h2>
            <div
              className="x"
              role="button"
              tabIndex={0}
              aria-label="Close Pond Care"
              onClick={() => nav.setCareOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  nav.setCareOpen(false);
                }
              }}
            >
              ✕
            </div>
          </div>
          <p>
            Tend the water DeKoi swims in. Changes settle instantly across
            every surface.
          </p>
        </div>

        <div className="care-tabs">
          {CARE_TABS.map((tab, i) => (
            <div
              key={tab.label}
              className={`ctab${nav.careTab === i ? " on" : ""}`}
              role="tab"
              tabIndex={0}
              aria-selected={nav.careTab === i}
              onClick={() => nav.setCareTab(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  nav.setCareTab(i);
                }
              }}
            >
              {tab.label} <small>{tab.hint}</small>
            </div>
          ))}
        </div>

        <div className="care-body">
          {nav.careTab === 0 ? (
            <>
              <p className="care-intro">
                Water settings shape how the whole pond behaves — language,
                flow, and the small currents of everyday use.
              </p>

              <div className="field">
                <label htmlFor="care-language">Language of the water</label>
                <select className="pondsel" id="care-language">
                  <option>English</option>
                </select>
                <div className="help">
                  English is the only current bundled for now. New languages
                  will surface here as they're stocked — without disturbing your
                  layout.
                </div>
              </div>

              <div className="toggle-row">
                <div className="tl">
                  <b>Let replies ripple in</b>
                  <i>stream responses word by word</i>
                </div>
                <Switch
                  checked={streamReplies}
                  onChange={setStreamReplies}
                  ariaLabel="Let replies ripple in"
                />
              </div>
              <div className="toggle-row">
                <div className="tl">
                  <b>Spotify mini player</b>
                  <i>a little music by the pond</i>
                </div>
                <Switch
                  checked={spotifyPlayer}
                  onChange={setSpotifyPlayer}
                  ariaLabel="Spotify mini player"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Ripple speed</b>
                  <span>{rippleSpeed}</span>
                </div>
                <Slider
                  value={rippleSpeed}
                  onChange={setRippleSpeed}
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
                  checked={surfaceAllText}
                  onChange={setSurfaceAllText}
                  ariaLabel="Surface all text at once"
                />
              </div>
              <div className="toggle-row">
                <div className="tl">
                  <b>Wheel + click to navigate</b>
                  <i>scroll through the depths</i>
                </div>
                <Switch
                  checked={wheelNavigate}
                  onChange={setWheelNavigate}
                  ariaLabel="Wheel + click to navigate"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Narration drift</b>
                  <span>{narrationDrift}</span>
                </div>
                <Slider
                  value={narrationDrift}
                  onChange={setNarrationDrift}
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
                  <span>{(autoplayPause / 10).toFixed(1)}s</span>
                </div>
                <Slider
                  value={autoplayPause}
                  onChange={setAutoplayPause}
                  ariaLabel="Auto-play pause between segments"
                />
                <div className="track-ends">
                  <span>Short</span>
                  <span>Long</span>
                </div>
              </div>

              <div className="field">
                <label>Send on Enter</label>
                <div
                  className="help"
                  style={{ marginTop: 0, marginBottom: 10 }}
                >
                  Choose which surface sends when you press Enter.
                </div>
                <Seg
                  options={SEND_ON_ENTER_SURFACES}
                  value={sendOnEnter}
                  onChange={setSendOnEnter}
                  ariaLabel="Send on Enter surface"
                />
              </div>

              <div className="toggle-row" style={{ borderBottom: "none" }}>
                <div className="tl">
                  <b>Ask before releasing a koi</b>
                  <i>confirm before deleting</i>
                </div>
                <Switch
                  checked={confirmRelease}
                  onChange={setConfirmRelease}
                  ariaLabel="Ask before releasing a koi"
                />
              </div>
            </>
          ) : nav.careTab === 7 ? (
            <form className="runtime-panel" onSubmit={handleRuntimeSubmit}>
              <p className="care-intro">
                Deep Water controls where saved Bubbles settle.
              </p>

              <div className="field">
                <label htmlFor="remote-runtime-url">Remote Runtime URL</label>
                <input
                  className="pondinput"
                  id="remote-runtime-url"
                  type="url"
                  placeholder="http://127.0.0.1:7341"
                  value={runtimeUrl}
                  onChange={(event) => setRuntimeUrl(event.target.value)}
                />
                <div className="help">Leave empty to use this browser only.</div>
              </div>

              <div className={`runtime-status ${nav.bubbleStorageStatus}`}>
                <b>
                  {nav.bubbleStorageMode === "remote"
                    ? "Remote runtime"
                    : "Local storage"}
                </b>
                <span>{runtimeStatusMessage}</span>
              </div>

              <div className="runtime-actions">
                <button type="submit">Apply</button>
                <button type="button" onClick={handleRuntimeTest}>
                  Test
                </button>
                <button type="button" onClick={handleUseLocalStorage}>
                  Use local
                </button>
              </div>
            </form>
          ) : (
            <p style={{ color: "var(--mist)", fontSize: 13, marginTop: 20 }}>
              {CARE_TABS[nav.careTab].label} settings — coming soon.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
