import { describe, expect, it } from "vitest";

import {
  createMessengerGenerationContext,
  createMessengerGenerationRequestAssembly,
  type MessengerGenerationContext,
} from "./messenger-generation";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";
import { createMessengerThread } from "../modes/messenger/messenger-actions";
import { createMessengerModeBranch } from "../modes/mode-thread/mode-thread-actions";
import type { MessengerModeThread, ModeMessage } from "../contracts/types/mode-thread";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";

const now = "2026-07-14T00:00:00.000Z";

function message(id: string, branchId: string, body: string): ModeMessage {
  return createModeMessage({
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body,
    branchId,
    id,
    origin: "manual",
    threadId: "thread-1",
    versionId: `${id}-v1`,
    now,
  });
}

function contextWithMessage() {
  const thread = createMessengerThread({
    activePersonaId: null,
    branchId: "branch-1",
    characterIds: [],
    id: "thread-1",
    now,
    title: "Test",
  });
  const activeMessage = message("message-1", "branch-1", "active body");
  const siblingBranch = createMessengerModeBranch({
    activePersonaId: null,
    characterIds: [],
    id: "branch-2",
    now,
    threadId: thread.id,
  });
  const siblingMessage = message("sibling-message", "branch-2", "sibling body");
  return createMessengerGenerationContext({
    characters: [],
    lorebooks: [],
    personas: [],
    thread: {
      ...thread,
      branches: [thread.branches[0], siblingBranch],
      messages: [activeMessage, siblingMessage],
    },
  });
}

function assemble(context: ReturnType<typeof contextWithMessage>, userMessage: ModeMessage) {
  return createMessengerGenerationRequestAssembly({
    context,
    id: "request-1",
    now,
    userMessage,
  });
}

describe("Messenger generation user message projection", () => {
  it("rejects messages from sibling branches", () => {
    const context = contextWithMessage();
    const sibling = message("sibling-message", "branch-2", "sibling body");

    expect(() => assemble(context, sibling)).toThrow(/inactive branch/);
  });

  it("rejects messages from another thread", () => {
    const context = contextWithMessage();
    const active = context.requestThread.messages[0];

    expect(() => assemble(context, { ...active, threadId: "foreign-thread" })).toThrow(
      /foreign thread/,
    );
  });

  it("projects the canonical active version into the request and lastInput macro", () => {
    const context = contextWithMessage();
    const canonical = context.requestThread.messages[0];
    const activeVersion = { ...canonical.versions[0], id: "message-1-v2", body: "active body" };
    const inactiveVersion = { ...canonical.versions[0], id: "message-1-v1", body: "stale body" };
    const updatedCanonical: ModeMessage = {
      ...canonical,
      versions: [inactiveVersion, activeVersion],
      activeVersionId: activeVersion.id,
    };
    const thread: MessengerModeThread = {
      ...context.requestThread,
      messages: [updatedCanonical],
    };
    const projectedContext: MessengerGenerationContext = {
      ...context,
      promptPreset: { systemPrompt: "{{input}}" } as PromptPresetRecord,
      requestThread: thread,
    };
    const supplied: ModeMessage = {
      ...updatedCanonical,
      versions: [inactiveVersion],
      activeVersionId: inactiveVersion.id,
    };

    const assembly = assemble(projectedContext, supplied);

    expect(assembly.request.userMessage.versions).toEqual([activeVersion]);
    expect(assembly.request.userMessage.versions[0].body).toBe("active body");
    expect(
      assembly.request.promptMessages.some((item) => item.content.includes("active body")),
    ).toBe(true);
    expect(
      assembly.request.promptMessages.some((item) => item.content.includes("stale body")),
    ).toBe(false);
  });
});
