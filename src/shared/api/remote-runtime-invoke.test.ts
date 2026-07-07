import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "./remote-runtime-invoke";
import {
  fetchRemoteRuntimeJson,
  REMOTE_RUNTIME_COMMAND_TIMEOUT_MS,
  REMOTE_RUNTIME_GENERATION_TIMEOUT_MS,
} from "./remote-runtime-http";
import { RUNTIME_COMMANDS, type RemoteRuntimeCommand } from "./runtime-commands";

vi.mock("./desktop-host-common", () => ({
  isDesktopHostAvailable: vi.fn(() => false),
}));

vi.mock("./desktop-runtime", () => ({
  invokeDesktopRuntime: vi.fn(),
}));

vi.mock("./remote-runtime-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./remote-runtime-http")>();
  return {
    ...actual,
    fetchRemoteRuntimeJson: vi.fn(),
  };
});

const fetchRemoteRuntimeJsonMock = vi.mocked(fetchRemoteRuntimeJson);

describe("invokeRemote", () => {
  beforeEach(() => {
    fetchRemoteRuntimeJsonMock.mockReset();
    fetchRemoteRuntimeJsonMock.mockResolvedValue({ ok: true, status: 200, body: { ok: true } });
  });

  it("uses the generation timeout for remote generation commands", async () => {
    await invokeRemote(RUNTIME_COMMANDS.generationGenerate, {}, "https://runtime.test");

    expect(fetchRemoteRuntimeJsonMock).toHaveBeenCalledWith(
      "https://runtime.test/api/invoke",
      expect.objectContaining({ method: "POST" }),
      REMOTE_RUNTIME_GENERATION_TIMEOUT_MS,
    );
  });

  it.each<RemoteRuntimeCommand>([
    RUNTIME_COMMANDS.providerConnectionCheck,
    RUNTIME_COMMANDS.providerConnectionModels,
    RUNTIME_COMMANDS.storageCreate,
    RUNTIME_COMMANDS.storageDelete,
    RUNTIME_COMMANDS.storageList,
    RUNTIME_COMMANDS.storageReplace,
    RUNTIME_COMMANDS.storageUpdate,
  ])("uses the command timeout for %s", async (command) => {
    await invokeRemote(command, {}, "https://runtime.test");

    expect(fetchRemoteRuntimeJsonMock).toHaveBeenLastCalledWith(
      "https://runtime.test/api/invoke",
      expect.objectContaining({ method: "POST" }),
      REMOTE_RUNTIME_COMMAND_TIMEOUT_MS,
    );
  });

  it("surfaces non-OK remote runtime errors from JSON message bodies", async () => {
    fetchRemoteRuntimeJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      body: { message: "Token expired." },
    });

    await expect(
      invokeRemote(RUNTIME_COMMANDS.storageList, {}, "https://runtime.test"),
    ).rejects.toThrow("Token expired.");
  });

  it("falls back to the HTTP status when non-OK error bodies are unreadable", async () => {
    fetchRemoteRuntimeJsonMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      body: null,
    });

    await expect(
      invokeRemote(RUNTIME_COMMANDS.storageList, {}, "https://runtime.test"),
    ).rejects.toThrow("Remote runtime returned 500.");
  });
});
