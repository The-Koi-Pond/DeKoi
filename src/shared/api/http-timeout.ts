/** Formats timeout values for user-facing timeout messages. */
export function formatTimeoutDuration(timeoutMs: number) {
  if (timeoutMs % 1000 === 0) {
    const seconds = timeoutMs / 1000;
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }

  return `${timeoutMs} ms`;
}

function defaultTimeoutMessage(timeoutMs: number) {
  return `Request timed out after ${formatTimeoutDuration(timeoutMs)}.`;
}

function abortReasonError(reason: unknown) {
  if (reason instanceof Error) return reason;
  return new Error("Request was aborted.", { cause: reason });
}

export type FetchJsonWithTimeoutOptions = {
  /** Return false to preserve the HTTP status without attempting JSON parsing. */
  shouldReadBody?: (response: Response) => boolean;
};

function responseJsonReadError(response: Response, error: unknown) {
  return new Error(`HTTP ${response.status} response body could not be read as JSON.`, {
    cause: error,
  });
}

async function runWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  callerSignal: AbortSignal | null,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await operation(callerSignal ?? new AbortController().signal);
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutError: Error | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let abortFromCaller: (() => void) | null = null;

  // These race entries intentionally perform the abort side effects before
  // settling, so timeout and caller cancellation keep distinct error messages.
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      timeoutError = new Error(timeoutMessage);
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  const callerAbortPromise = callerSignal
    ? new Promise<never>((_resolve, reject) => {
        abortFromCaller = () => {
          const error = abortReasonError(callerSignal.reason);
          controller.abort(error);
          reject(error);
        };

        if (callerSignal.aborted) {
          abortFromCaller();
        } else {
          callerSignal.addEventListener("abort", abortFromCaller, { once: true });
        }
      })
    : null;

  try {
    return await Promise.race([
      operation(controller.signal),
      timeoutPromise,
      ...(callerAbortPromise ? [callerAbortPromise] : []),
    ]);
  } catch (error) {
    if (timedOut && error !== timeoutError) {
      throw new Error(timeoutMessage, { cause: error });
    }

    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (abortFromCaller) callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

/**
 * Runs fetch with a deadline while preserving caller-signal abort reasons.
 * Non-positive or non-finite timeout values disable the extra deadline.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number,
  timeoutMessage = defaultTimeoutMessage(timeoutMs),
): Promise<Response> {
  return await runWithTimeout(
    async (signal) => await fetch(input, { ...init, signal }),
    timeoutMs,
    timeoutMessage,
    init.signal ?? null,
  );
}

/**
 * Fetches and parses JSON under one deadline, including response-body reads.
 * Successful unreadable JSON rejects; unreadable non-OK bodies return null.
 */
export async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number,
  timeoutMessage = defaultTimeoutMessage(timeoutMs),
  options: FetchJsonWithTimeoutOptions = {},
): Promise<{ response: Response; body: unknown }> {
  return await runWithTimeout(
    async (signal) => {
      const response = await fetch(input, { ...init, signal });
      let body: unknown = null;

      if (options.shouldReadBody?.(response) ?? true) {
        try {
          body = await response.json();
        } catch (error) {
          if (signal.aborted) throw error;
          if (!response.ok) {
            body = null;
            return { response, body };
          }
          throw responseJsonReadError(response, error);
        }
      }

      return { response, body };
    },
    timeoutMs,
    timeoutMessage,
    init.signal ?? null,
  );
}
