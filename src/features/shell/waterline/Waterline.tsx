import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { NavCareActions, NavViewActions } from "../../navigation";
import {
  closeDesktopWindow,
  getDesktopWindowState,
  minimizeDesktopWindow,
  restoreDesktopWindow,
  startDesktopWindowDrag,
  toggleDesktopWindowMaximize,
} from "../../../shared/api/window-controls";
import "./Waterline.css";

type WindowControlAction = "close" | "maximize" | "minimize";
type WindowControlState = Awaited<ReturnType<typeof getDesktopWindowState>>;

const defaultWindowState: WindowControlState = {
  minimized: false,
  maximized: false,
};

interface WaterlineProps {
  nav: WaterlineNav;
}

export type WaterlineNav = Pick<NavCareActions, "setCareOpen"> &
  Pick<NavViewActions, "setView">;

export function Waterline({ nav }: WaterlineProps) {
  const [windowState, setWindowState] = useState(defaultWindowState);

  const isNoDragTarget = useCallback((target: EventTarget | null) => {
    return target instanceof Element && !!target.closest("[data-window-no-drag]");
  }, []);

  const refreshWindowState = useCallback(() => {
    void getDesktopWindowState()
      .then(setWindowState)
      .catch(() => setWindowState(defaultWindowState));
  }, []);

  const refreshWindowStateSoon = useCallback(() => {
    window.setTimeout(refreshWindowState, 40);
    window.setTimeout(refreshWindowState, 180);
  }, [refreshWindowState]);

  useEffect(() => {
    refreshWindowState();

    window.addEventListener("focus", refreshWindowState);
    window.addEventListener("resize", refreshWindowState);
    document.addEventListener("visibilitychange", refreshWindowState);

    return () => {
      window.removeEventListener("focus", refreshWindowState);
      window.removeEventListener("resize", refreshWindowState);
      document.removeEventListener("visibilitychange", refreshWindowState);
    };
  }, [refreshWindowState]);

  const startWindowDrag = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0 || event.detail > 1 || isNoDragTarget(event.target)) {
        return;
      }

      void startDesktopWindowDrag().catch(() => {});
    },
    [isNoDragTarget],
  );

  const toggleMaximizeFromTitlebar = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (isNoDragTarget(event.target)) return;
      void toggleDesktopWindowMaximize()
        .then(refreshWindowStateSoon)
        .catch(() => {});
    },
    [isNoDragTarget, refreshWindowStateSoon],
  );

  function runWindowControl(action: WindowControlAction) {
    const task =
      action === "minimize"
        ? windowState.minimized
          ? restoreDesktopWindow()
          : minimizeDesktopWindow()
        : action === "maximize"
          ? toggleDesktopWindowMaximize()
          : closeDesktopWindow();
    void task
      .then(() => {
        if (action !== "close") refreshWindowStateSoon();
      })
      .catch(() => {});
  }

  const minimizeTitle = windowState.minimized ? "Restore" : "Minimize";
  const maximizeTitle = windowState.maximized ? "Restore" : "Maximize";

  return (
    <header
      className="waterline"
      onMouseDown={startWindowDrag}
      onDoubleClick={toggleMaximizeFromTitlebar}
    >
      <button
        type="button"
        className="brand"
        aria-label="Go to Home"
        title="Home"
        data-window-no-drag
        onClick={() => nav.setView({ kind: "pond" })}
      >
        <img className="mark" src="/logo.png" alt="" />
      </button>
      <div className="pebbles" data-window-no-drag>
        <button
          type="button"
          className="settings-button"
          title="Settings"
          aria-label="Settings"
          onClick={() => nav.setCareOpen(true)}
        >
          <span aria-hidden="true">⚙</span>
        </button>
        <div className="window-controls" aria-label="Window controls">
          <button
            type="button"
            className="window-control minimize"
            title={minimizeTitle}
            aria-label={`${minimizeTitle} window`}
            onClick={() => runWindowControl("minimize")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              {windowState.minimized ? (
                <>
                  <rect x="2.5" y="4.5" width="7" height="5" rx="1" />
                  <path d="M4.2 4.5 6 2.7l1.8 1.8" />
                </>
              ) : (
                <path d="M2 8.5h8" />
              )}
            </svg>
          </button>
          <button
            type="button"
            className="window-control maximize"
            title={maximizeTitle}
            aria-label={`${maximizeTitle} window`}
            onClick={() => runWindowControl("maximize")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              {windowState.maximized ? (
                <>
                  <path d="M4.5 2.5h5v5h-2" />
                  <rect x="2.5" y="4.5" width="5" height="5" rx="0.8" />
                </>
              ) : (
                <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
              )}
            </svg>
          </button>
          <button
            type="button"
            className="window-control close"
            title="Close"
            aria-label="Close window"
            onClick={() => runWindowControl("close")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6" />
              <path d="M9 3l-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
