// requestIdleCallback is not present in every TS DOM lib or browser runtime.
export type IdleHandle = number;

type WindowWithIdleCallbacks = Window & {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function browserWindow(): WindowWithIdleCallbacks | null {
  return typeof window === "undefined" ? null : window;
}

export function requestIdle(cb: () => void, options?: { timeout: number }): IdleHandle {
  const currentWindow = browserWindow();
  if (currentWindow?.requestIdleCallback) {
    return currentWindow.requestIdleCallback(cb, options);
  }

  return globalThis.setTimeout(cb, 1) as unknown as IdleHandle;
}

export function cancelIdle(handle: IdleHandle) {
  const currentWindow = browserWindow();
  if (currentWindow?.cancelIdleCallback) {
    currentWindow.cancelIdleCallback(handle);
    return;
  }

  globalThis.clearTimeout(handle);
}
