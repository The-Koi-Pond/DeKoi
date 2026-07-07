import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJsonWithTimeout, fetchWithTimeout, formatTimeoutDuration } from "./http-timeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts hung fetches with the timeout message", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason ?? new Error("aborted")),
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchWithTimeout("https://example.test", {}, 50, "Request took too long.");
    const expectation = expect(request).rejects.toThrow("Request took too long.");

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not rewrite caller cancellation as a timeout", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Caller cancelled.")), {
          once: true,
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchWithTimeout(
      "https://example.test",
      { signal: callerController.signal },
      1_000,
      "Request took too long.",
    );
    const expectation = expect(request).rejects.toThrow("User cancelled.");

    callerController.abort(new Error("User cancelled."));

    await expectation;
  });
});

describe("fetchJsonWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const response = {
        ok: true,
        status: 200,
        json: () =>
          new Promise<unknown>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason ?? new Error("aborted")),
              { once: true },
            );
          }),
      } as Response;

      return Promise.resolve(response);
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchJsonWithTimeout("https://example.test", {}, 50, "Body took too long.");
    const expectation = expect(request).rejects.toThrow("Body took too long.");

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });

  it("throws when a successful response body cannot be read as JSON", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
      } as unknown as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJsonWithTimeout("https://example.test", {}, 50, "Body took too long."),
    ).rejects.toThrow("HTTP 200 response body could not be read as JSON.");
  });

  it("can skip the response body while preserving the response status", async () => {
    const json = vi.fn().mockRejectedValue(new Error("slow body should not be read"));
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        json,
      } as unknown as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithTimeout(
      "https://example.test",
      {},
      50,
      "Body took too long.",
      { shouldReadBody: (response) => response.ok },
    );

    expect(result.response.status).toBe(503);
    expect(result.body).toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("allows unreadable non-OK response bodies to preserve status handling", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
      } as unknown as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithTimeout(
      "https://example.test",
      {},
      50,
      "Body took too long.",
    );

    expect(result.response.status).toBe(401);
    expect(result.body).toBeNull();
  });
});

describe("formatTimeoutDuration", () => {
  it("formats second-based and millisecond-based durations", () => {
    expect(formatTimeoutDuration(5_000)).toBe("5 seconds");
    expect(formatTimeoutDuration(1_500)).toBe("1500 ms");
  });
});
