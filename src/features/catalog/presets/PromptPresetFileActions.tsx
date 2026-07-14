import { useId, useRef, useState, type ChangeEvent } from "react";
import type {
  NavCatalogState,
  NavPromptPresetActions,
  NavPromptPresetFileExportResult,
  NavPromptPresetFileImportResult,
  NavViewState,
} from "../../navigation";
import {
  runPromptPresetImport,
  unexpectedPromptPresetFileErrorStatus,
} from "./prompt-preset-file-import";
import { useCatalogNavigationLifecycle } from "./useCatalogNavigationLifecycle";

interface PromptPresetFileActionsBaseProps {
  host: NavCatalogState["promptPresetFileHost"];
  importPromptPresetFile: NavPromptPresetActions["importPromptPresetFile"];
  openPromptPresetFile: NavPromptPresetActions["openPromptPresetFile"];
  exportPromptPresetFile: NavPromptPresetActions["exportPromptPresetFile"];
  navigationContext: NavViewState["view"];
  originActive: boolean;
  status: string;
  onImportedPresetReady: (presetId: string) => void;
  onStatusChange: (status: string) => void;
}

interface PromptPresetListFileActionsProps extends PromptPresetFileActionsBaseProps {
  visibility: "list";
  selectedPresetId?: never;
  exportBlockedReason?: never;
}

interface PromptPresetEditorFileActionsProps extends PromptPresetFileActionsBaseProps {
  visibility: "editor";
  selectedPresetId: string;
  exportBlockedReason?: string;
}

interface PromptPresetStatusFileActionsProps extends PromptPresetFileActionsBaseProps {
  visibility: "status";
  selectedPresetId?: never;
  exportBlockedReason?: never;
}

type PromptPresetFileActionsProps =
  | PromptPresetListFileActionsProps
  | PromptPresetEditorFileActionsProps
  | PromptPresetStatusFileActionsProps;

function exportStatus(result: NavPromptPresetFileExportResult): string {
  if (result.ok)
    return result.path ? `Exported to ${result.path}.` : `Exported ${result.filename}.`;
  return result.cancelled ? "Export cancelled." : `Export failed: ${result.error}`;
}

export function PromptPresetFileActions({
  host,
  visibility,
  selectedPresetId,
  exportBlockedReason,
  importPromptPresetFile,
  openPromptPresetFile,
  exportPromptPresetFile,
  navigationContext,
  originActive,
  status,
  onImportedPresetReady,
  onStatusChange,
}: PromptPresetFileActionsProps) {
  const headingId = useId();
  const exportReasonId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { captureOriginCurrent, isMounted } = useCatalogNavigationLifecycle(
    navigationContext,
    originActive,
  );
  const [busyAction, setBusyAction] = useState<"import" | "export" | null>(null);

  async function runImport(importFile: () => Promise<NavPromptPresetFileImportResult>) {
    const isOriginCurrent = captureOriginCurrent();
    setBusyAction("import");
    try {
      await runPromptPresetImport({
        importFile,
        isOriginCurrent,
        onImportedPresetReady,
        onStatusChange,
      });
    } finally {
      if (isMounted()) setBusyAction(null);
    }
  }

  async function handleBrowserFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!file) return;

    await runImport(() => importPromptPresetFile(file));
  }

  async function handleDesktopImport() {
    await runImport(openPromptPresetFile);
  }

  async function handleExport() {
    if (!selectedPresetId || exportBlockedReason) return;

    onStatusChange("");
    setBusyAction("export");
    try {
      onStatusChange(exportStatus(await exportPromptPresetFile(selectedPresetId)));
    } catch (error) {
      onStatusChange(unexpectedPromptPresetFileErrorStatus("Export", error));
    } finally {
      setBusyAction(null);
    }
  }

  const importBusy = busyAction === "import";
  const exportBusy = busyAction === "export";

  if (visibility === "status" && !status) return null;

  return (
    <section className="catalog-editor-section preset-file-actions" aria-labelledby={headingId}>
      <div className="catalog-section-heading-row">
        <h4 id={headingId}>Preset file</h4>
        <div className="catalog-button-row">
          {visibility === "list" && host === "browser" ? (
            <>
              <input
                ref={inputRef}
                className="preset-file-input"
                type="file"
                accept="application/json,.json,.marinara.json"
                onChange={handleBrowserFileChange}
              />
              <button
                type="button"
                className="catalog-new-btn"
                disabled={busyAction !== null}
                onClick={() => inputRef.current?.click()}
              >
                {importBusy ? "Importing JSON..." : "Import JSON"}
              </button>
            </>
          ) : visibility === "list" ? (
            <button
              type="button"
              className="catalog-new-btn"
              disabled={busyAction !== null}
              onClick={handleDesktopImport}
            >
              {importBusy ? "Importing JSON..." : "Import JSON"}
            </button>
          ) : null}
          {visibility === "editor" && (
            <button
              type="button"
              className="catalog-new-btn"
              disabled={busyAction !== null || Boolean(exportBlockedReason)}
              aria-describedby={exportBlockedReason ? exportReasonId : undefined}
              onClick={handleExport}
            >
              {exportBusy ? "Exporting JSON..." : "Export JSON"}
            </button>
          )}
        </div>
      </div>
      <p className="catalog-field-hint preset-file-note">
        Import or export one prompt preset. Full Pond bundles remain separate in Pond Care.
      </p>
      {visibility === "editor" && exportBlockedReason && (
        <p className="catalog-field-hint preset-file-status" id={exportReasonId}>
          {exportBlockedReason}
        </p>
      )}
      {status && (
        <p className="preset-file-status" role={status.includes("failed") ? "alert" : "status"}>
          {status}
        </p>
      )}
    </section>
  );
}
