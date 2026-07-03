import type { GenerationNoticeAction } from "./generation-notice-actions";

export type GenerationNoticeStatus = "idle" | "generating" | "warning" | "error";

interface GenerationNoticeProps {
  action: GenerationNoticeAction | null;
  fallbackMessage: string;
  message: string;
  onAction: () => void;
  onDismiss: () => void;
  status: GenerationNoticeStatus;
}

export function GenerationNotice({
  action,
  fallbackMessage,
  message,
  onAction,
  onDismiss,
  status,
}: GenerationNoticeProps) {
  if (status === "idle") return null;

  const canDismiss = status === "error" || status === "warning";

  return (
    <div
      className={`thread-generation-notice ${status}`}
      role={status === "error" ? "alert" : "status"}
    >
      <span>{message || fallbackMessage}</span>
      {canDismiss && (
        <div className="thread-generation-actions">
          {action && (
            <button type="button" className="thread-generation-action" onClick={onAction}>
              {action.label}
            </button>
          )}
          <button
            type="button"
            className="thread-generation-dismiss"
            aria-label="Dismiss generation message"
            title="Dismiss"
            onClick={onDismiss}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
