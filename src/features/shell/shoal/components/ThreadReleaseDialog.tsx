import type { ThreadReleaseRequest } from "../types";

interface ThreadReleaseDialogProps {
  request: ThreadReleaseRequest;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ThreadReleaseDialog({ request, onCancel, onConfirm }: ThreadReleaseDialogProps) {
  return (
    <div className="release-dialog-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="release-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-thread-title"
        aria-describedby="release-thread-copy"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="release-dialog-icon" aria-hidden="true">
          ×
        </div>
        <div className="release-dialog-copy">
          <h2 id="release-thread-title">
            Release {request.kind === "roleplay" ? "scene" : "thread"}?
          </h2>
          <p id="release-thread-copy">
            <b>{request.title}</b> will be removed from the Shoal.
          </p>
        </div>
        <div className="release-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}>
            Release
          </button>
        </div>
      </section>
    </div>
  );
}
