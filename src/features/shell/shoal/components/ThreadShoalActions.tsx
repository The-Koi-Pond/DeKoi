import { FolderIcon } from "./ShoalIcons";

interface ThreadShoalActionsProps {
  isRoleplaySurface: boolean;
  newMessengerOpen: boolean;
  newRoleplayOpen: boolean;
  onCreateActiveThread: () => void;
}

export function ThreadShoalActions({
  isRoleplaySurface,
  newMessengerOpen,
  newRoleplayOpen,
  onCreateActiveThread,
}: ThreadShoalActionsProps) {
  return (
    <div className="shoal-title">
      <button
        className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-cast`}
        type="button"
        aria-controls={
          isRoleplaySurface
            ? "new-roleplay-thread-popover"
            : "new-messenger-thread-popover"
        }
        aria-expanded={isRoleplaySurface ? newRoleplayOpen : newMessengerOpen}
        onClick={onCreateActiveThread}
      >
        {isRoleplaySurface ? "+ New Roleplay" : "+ Cast a Line"}
      </button>
      <button
        className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-folder`}
        type="button"
        title="Add grouping folder"
        aria-label="Add grouping folder"
        disabled
      >
        <FolderIcon />
        Folder
      </button>
    </div>
  );
}
