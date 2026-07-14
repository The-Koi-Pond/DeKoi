import { useId, useState } from "react";

import type { NavPromptPresetActions, NavViewState } from "../../navigation";
import { restoreStarterPromptPresetAndNavigate } from "./prompt-presets-navigation";
import { useCatalogNavigationLifecycle } from "./useCatalogNavigationLifecycle";

interface RestoreStarterPresetActionProps {
  restoreStarterPromptPreset: NavPromptPresetActions["restoreStarterPromptPreset"];
  navigationContext: NavViewState["view"];
  originActive: boolean;
  onRestoredPresetReady: (presetId: string) => void;
}

export function RestoreStarterPresetAction({
  restoreStarterPromptPreset,
  navigationContext,
  originActive,
  onRestoredPresetReady,
}: RestoreStarterPresetActionProps) {
  const headingId = useId();
  const { captureOriginCurrent, isMounted } = useCatalogNavigationLifecycle(
    navigationContext,
    originActive,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    if (pending) return;
    const isOriginCurrent = captureOriginCurrent();

    setPending(true);
    setError(null);
    try {
      await restoreStarterPromptPresetAndNavigate({
        restoreStarterPromptPreset,
        onRestoredPresetReady,
        setError,
        isOriginCurrent,
      });
    } catch (cause) {
      if (isOriginCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
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
      {error && (
        <p role="alert" className="catalog-surface-error">
          {error}
        </p>
      )}
    </section>
  );
}
