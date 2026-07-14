import { useId, useState } from "react";

import type { NavPromptPresetActions, NavViewState } from "../../navigation";
import { restoreStarterPromptPresetAndNavigate } from "./prompt-presets-navigation";
import { useCatalogNavigationLifecycle } from "./useCatalogNavigationLifecycle";

interface RestoreStarterPresetActionProps {
  restoreStarterPromptPreset: NavPromptPresetActions["restoreStarterPromptPreset"];
  setPromptPresetCatalogStatus: (status: string) => void;
  navigationContext: NavViewState["view"];
  sideRailView: NavViewState["sideRailView"];
  originActive: boolean;
  onRestoredPresetReady: (presetId: string) => void;
}

export function RestoreStarterPresetAction({
  restoreStarterPromptPreset,
  setPromptPresetCatalogStatus,
  navigationContext,
  sideRailView,
  originActive,
  onRestoredPresetReady,
}: RestoreStarterPresetActionProps) {
  const headingId = useId();
  const { captureOriginCurrent, isMounted } = useCatalogNavigationLifecycle(
    navigationContext,
    sideRailView,
    originActive,
  );
  const [pending, setPending] = useState(false);

  async function handleRestore() {
    if (pending) return;
    const isOriginCurrent = captureOriginCurrent();

    setPending(true);
    setPromptPresetCatalogStatus("");
    try {
      await restoreStarterPromptPresetAndNavigate({
        restoreStarterPromptPreset,
        onRestoredPresetReady,
        setPromptPresetCatalogStatus,
        isOriginCurrent,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setPromptPresetCatalogStatus(`Restore failed. ${message}`);
    } finally {
      if (isMounted()) setPending(false);
    }
  }

  return (
    <section className="catalog-editor-section" aria-labelledby={headingId}>
      <div className="catalog-section-heading-row">
        <h4 id={headingId}>Starter preset</h4>
        <button
          type="button"
          className="catalog-new-btn"
          onClick={handleRestore}
          disabled={pending}
        >
          {pending ? "Restoring…" : "Restore Starter Preset"}
        </button>
      </div>
      <p className="catalog-field-hint">
        Create a fresh copy of DeKoi&apos;s bundled starter. Existing presets and your default stay
        unchanged.
      </p>
    </section>
  );
}
