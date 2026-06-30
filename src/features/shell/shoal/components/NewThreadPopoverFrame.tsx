import type { FormEventHandler, ReactNode } from "react";

interface NewThreadPopoverFrameProps {
  children: ReactNode;
  closeLabel: string;
  id: string;
  title: string;
  titleId: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function NewThreadPopoverFrame({
  children,
  closeLabel,
  id,
  title,
  titleId,
  onClose,
  onSubmit,
}: NewThreadPopoverFrameProps) {
  return (
    <div className="new-thread-backdrop" role="presentation" onClick={onClose}>
      <form
        className="new-thread-popover"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="new-thread-popover-head">
          <b id={titleId}>{title}</b>
          <button type="button" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}
