interface DesktopStorageActionsProps {
  desktopStorageBusy: boolean;
  desktopStorageStatus: string;
  onDesktopStorageSave: () => void;
  onDesktopStorageLoad: () => void;
}

export function DesktopStorageActions({
  desktopStorageBusy,
  desktopStorageStatus,
  onDesktopStorageSave,
  onDesktopStorageLoad,
}: DesktopStorageActionsProps) {
  return (
    <>
      <div className="runtime-actions">
        <button
          type="button"
          className="care-btn primary"
          disabled={desktopStorageBusy}
          onClick={onDesktopStorageSave}
        >
          Save host bundle
        </button>
        <button type="button" disabled={desktopStorageBusy} onClick={onDesktopStorageLoad}>
          Load host bundle
        </button>
      </div>

      {desktopStorageStatus && <p className="bundle-status">{desktopStorageStatus}</p>}
    </>
  );
}
