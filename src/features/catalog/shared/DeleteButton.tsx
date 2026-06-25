import { useState } from "react";
import { useNav } from "../../navigation/nav-context";

/**
 * Delete affordance for catalog cards. Honors the global
 * `appSettings.confirmRelease` ("Ask before releasing a koi") setting:
 *
 * - When `confirmRelease` is false, deletes immediately on click.
 * - When true, the first click reveals an inline "confirm / cancel" pair, and
 *   only the confirm click runs `onConfirm`. Escape or losing focus cancels.
 *
 * Replaces the bare `✕` buttons in the catalog surfaces so the persisted
 * setting finally has an effect on catalog deletes.
 */
interface DeleteButtonProps {
  onConfirm: () => void;
  ariaLabel: string;
}

export function DeleteButton({ onConfirm, ariaLabel }: DeleteButtonProps) {
  const nav = useNav();
  const confirmRelease = nav.appSettings.confirmRelease;
  const [pending, setPending] = useState(false);
  const [lastConfirmRelease, setLastConfirmRelease] = useState(confirmRelease);

  // If the setting flips off while a confirm is open, cancel back to the
  // resting state rather than ever auto-firing a pending delete.
  if (confirmRelease !== lastConfirmRelease) {
    setLastConfirmRelease(confirmRelease);
    setPending(false);
  }

  if (!confirmRelease) {
    return (
      <button
        type="button"
        className="catalog-action danger"
        aria-label={ariaLabel}
        onClick={onConfirm}
      >
        ✕
      </button>
    );
  }

  if (pending) {
    return (
      <span
        className="confirm-inline"
        role="group"
        aria-label={`Confirm ${ariaLabel}`}
      >
        <button
          type="button"
          className="catalog-action confirm-yes"
          aria-label={`Confirm ${ariaLabel}`}
          onClick={() => {
            setPending(false);
            onConfirm();
          }}
        >
          ✓
        </button>
        <button
          type="button"
          className="catalog-action confirm-no"
          aria-label={`Cancel ${ariaLabel}`}
          onClick={() => setPending(false)}
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="catalog-action danger"
      aria-label={ariaLabel}
      onClick={() => setPending(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPending(false);
      }}
    >
      ✕
    </button>
  );
}
