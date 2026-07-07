import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "./remote-runtime-invoke";
import { fetchRemoteRuntimeJson } from "./remote-runtime-http";
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
const commandTimeoutMs = 30_000;
const generationTimeoutMs = 120_000;

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
      generationTimeoutMs,
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
      commandTimeoutMs,
    );
  });
});
