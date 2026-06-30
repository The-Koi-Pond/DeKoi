import type { ReactNode } from "react";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsDrawerProps {
  children: ReactNode;
  drawerId: ChatSettingsDrawerId;
  open: boolean;
  summary: string;
  title: string;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

export function ChatSettingsDrawer({
  children,
  drawerId,
  open,
  summary,
  title,
  onToggle,
}: ChatSettingsDrawerProps) {
  const bodyId = `messenger-settings-${drawerId}-drawer`;

  return (
    <section className={`chat-settings-card${open ? " open" : ""}`}>
      <button
        type="button"
        className="chat-settings-section-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(drawerId)}
      >
        <span className="chat-settings-section-copy">
          <b>{title}</b>
          <small>{summary}</small>
        </span>
        <span className="chat-settings-drawer-icon" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="chat-settings-section-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

interface ChatSettingsNoticeProps {
  actionLabel?: string;
  children: ReactNode;
  onAction?: () => void;
}

export function ChatSettingsNotice({
  actionLabel,
  children,
  onAction,
}: ChatSettingsNoticeProps) {
  return (
    <div className="chat-settings-notice">
      <p>{children}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
