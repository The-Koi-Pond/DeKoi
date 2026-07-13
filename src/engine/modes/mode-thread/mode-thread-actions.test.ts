import { describe, expect, it } from "vitest";
import type {
  MessengerModeThread,
  ModeMessage,
  RoleplayModeThread,
} from "../../contracts/types/mode-thread";
import {
  appendModeMessages,
  assertValidModeThread,
  clearModeBranchMessages,
  createMessengerModeBranch,
  createModeMessage,
  createRoleplayModeBranch,
  deleteModeMessage,
  editActiveModeMessageVersion,
  getActiveModeBranch,
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
  getModeThreadActivityAt,
  renameModeThread,
  setModeBranchParticipants,
  setModeBranchPersona,
  setModeBranchLorebooks,
  setModeBranchProviderConnection,
  setModeBranchPreset,
  setModeBranchPresetChoiceSelections,
} from "./mode-thread-actions";

const thread: MessengerModeThread = {
  id: "thread-1",
  schemaVersion: 1,
  kind: "messenger",
  title: "T",
  activeBranchId: "branch-1",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  messages: [],
  branches: [
    {
      id: "branch-1",
      schemaVersion: 1,
      kind: "messenger",
      threadId: "thread-1",
      participantMode: "direct",
      characterIds: ["c"],
      activePersonaId: null,
      lorebookIds: [],
      presetId: null,
      presetChoiceSelectionsByPresetId: {},
      providerConnectionId: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      id: "branch-2",
      schemaVersion: 1,
      kind: "messenger",
      threadId: "thread-1",
      participantMode: "direct",
      characterIds: ["d"],
      activePersonaId: null,
      lorebookIds: [],
      presetId: null,
      presetChoiceSelectionsByPresetId: {},
      providerConnectionId: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
};

describe("mode-thread actions", () => {
  it("creates exact default branches and one-version messages", () => {
    const messengerBranch = createMessengerModeBranch({
      id: "branch",
      threadId: "thread",
      characterIds: [" c1 ", "c2"],
      activePersonaId: " persona ",
      presetId: " preset ",
      now: "2026-01-01",
    });
    expect(messengerBranch).toEqual({
      id: "branch",
      schemaVersion: 1,
      threadId: "thread",
      kind: "messenger",
      participantMode: "group",
      characterIds: ["c1", "c2"],
      activePersonaId: "persona",
      lorebookIds: [],
      presetId: "preset",
      presetChoiceSelectionsByPresetId: {},
      providerConnectionId: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    expect(Object.getPrototypeOf(messengerBranch.presetChoiceSelectionsByPresetId)).toBeNull();
    const roleplayInput = {
      id: "branch",
      threadId: "thread",
      characterIds: ["c1"],
      activePersonaId: null,
      now: "2026-01-01",
    };
    for (const replyStrategy of ["natural", "manual", "ordered", "round-robin"] as const) {
      expect(createRoleplayModeBranch({ ...roleplayInput, replyStrategy })).toMatchObject({
        kind: "roleplay",
        replyStrategy,
      });
    }
    expect(() =>
      createRoleplayModeBranch({ ...roleplayInput, replyStrategy: "invalid" as never }),
    ).toThrow("Invalid mode thread: reply strategy");

    const message = createModeMessage({
      id: "message",
      versionId: "version",
      threadId: "thread",
      branchId: "branch",
      author: { kind: "system", label: "System" },
      body: "Opening",
      origin: "sample",
      now: "2026-01-01",
    });
    expect(message.activeVersionId).toBe("version");
    expect(message.versions).toEqual([
      {
        id: "version",
        body: "Opening",
        origin: "sample",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);
    for (const origin of ["manual", "generated", "imported", "sample"] as const) {
      expect(
        createModeMessage({
          id: `message-${origin}`,
          versionId: `version-${origin}`,
          threadId: "thread",
          branchId: "branch",
          author: { kind: "system", label: "System" },
          body: "Opening",
          origin,
          now: "2026-01-01",
        }).versions[0].origin,
      ).toBe(origin);
    }
    expect(() =>
      createModeMessage({
        id: "message-invalid",
        versionId: "version-invalid",
        threadId: "thread",
        branchId: "branch",
        author: { kind: "system", label: "System" },
        body: "Opening",
        origin: "invalid" as never,
        now: "2026-01-01",
      }),
    ).toThrow("Invalid mode thread: version origin");
  });

  it("accepts a valid thread and rejects an invalid active branch", () => {
    expect(() => assertValidModeThread(thread)).not.toThrow();
    expect(() => assertValidModeThread({ ...thread, activeBranchId: "missing" })).toThrow();
  });

  it("rejects padded ids and cross-variant or legacy fields", () => {
    expect(() => assertValidModeThread({ ...thread, id: " thread-1" })).toThrow(
      "Invalid mode thread:",
    );
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], id: " branch-1" }, thread.branches[1]],
      }),
    ).toThrow("Invalid mode thread:");
    expect(() => assertValidModeThread({ ...thread, openingCharacterId: null } as never)).toThrow(
      "Invalid mode thread:",
    );
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], replyStrategy: "natural" }, thread.branches[1]],
      } as never),
    ).toThrow("Invalid mode thread:");
    expect(() =>
      assertValidModeThread({
        ...thread,
        messages: [
          {
            id: "m",
            schemaVersion: 1,
            threadId: thread.id,
            branchId: "branch-1",
            author: { kind: "system", label: "System", personaId: "p" },
            versions: [
              { id: "v", body: "x", origin: "manual", createdAt: "now", updatedAt: "now" },
            ],
            activeVersionId: "v",
            createdAt: "now",
            updatedAt: "now",
          },
        ],
      }),
    ).toThrow("Invalid mode thread:");
    const validMessage = {
      id: "m",
      schemaVersion: 1 as const,
      threadId: thread.id,
      branchId: "branch-1",
      author: { kind: "persona" as const, personaId: "p", label: "P" },
      versions: [
        { id: "v", body: "x", origin: "manual" as const, createdAt: "now", updatedAt: "now" },
      ],
      activeVersionId: "v",
      createdAt: "now",
      updatedAt: "now",
    };
    for (const invalid of [
      { ...validMessage, id: " m" },
      { ...validMessage, activeVersionId: " v" },
      { ...validMessage, threadId: " thread-1" },
      { ...validMessage, branchId: " branch-1" },
      { ...validMessage, author: { ...validMessage.author, personaId: " p" } },
      { ...validMessage, versions: [{ ...validMessage.versions[0], id: " v" }] },
    ]) {
      expect(() => assertValidModeThread({ ...thread, messages: [invalid] })).toThrow(
        "Invalid mode thread:",
      );
    }
    const roleplay = {
      ...thread,
      kind: "roleplay" as const,
      openingCharacterId: " opening",
      branches: [
        { ...thread.branches[0], kind: "roleplay" as const, replyStrategy: "natural" as const },
      ],
    };
    expect(() => assertValidModeThread(roleplay)).toThrow("Invalid mode thread:");
  });

  it("selects active branch/version and preserves sibling mutations", () => {
    const message: ModeMessage = {
      id: "m",
      schemaVersion: 1,
      threadId: "thread-1",
      branchId: "branch-1",
      author: { kind: "character", characterId: "c", label: "C" },
      versions: [
        {
          id: "v",
          body: "hello",
          origin: "manual",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
        {
          id: "inactive",
          body: "keep me",
          origin: "sample",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      activeVersionId: "v",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const siblingMessage: ModeMessage = {
      ...message,
      id: "m2",
      branchId: "branch-2",
      author: { kind: "unknown", label: "Historical" },
    };
    const withMessage = appendModeMessages(
      appendModeMessages(thread, [message]),
      [siblingMessage],
      "branch-2",
    );
    expect(getActiveModeBranch(withMessage).id).toBe("branch-1");
    expect(getActiveModeMessageVersion(message).body).toBe("hello");
    expect(getActiveModeBranchMessages(withMessage)).toHaveLength(1);
    expect(withMessage.messages.find((item) => item.id === "m2")?.branchId).toBe("branch-2");
    const edited = editActiveModeMessageVersion(withMessage, "m", " edited ", "2026-01-02");
    expect(edited.messages[0]).toMatchObject({
      author: { kind: "character", characterId: "c", label: "C" },
      updatedAt: "2026-01-02",
      versions: [
        { id: "v", body: "edited", updatedAt: "2026-01-02" },
        { id: "inactive", body: "keep me", updatedAt: "2026-01-01" },
      ],
    });
    expect(getModeThreadActivityAt(edited)).toBe("2026-01-02");
    expect(renameModeThread(edited, " Renamed ", "2026-01-03")).toMatchObject({
      title: "Renamed",
      updatedAt: "2026-01-03",
    });
    const cleared = clearModeBranchMessages(withMessage, "branch-1");
    expect(cleared.messages.map((item) => item.id)).toEqual(["m2"]);
    expect(cleared.branches[1].characterIds).toEqual(["d"]);
    expect(deleteModeMessage(withMessage, "m").messages.map((item) => item.id)).toEqual(["m2"]);
    expect(() =>
      editActiveModeMessageVersion(withMessage, "m2", "wrong branch", "2026-01-04"),
    ).toThrow("Invalid mode thread: target message");
    expect(() => deleteModeMessage(withMessage, "m2")).toThrow(
      "Invalid mode thread: target message",
    );
    expect(
      editActiveModeMessageVersion(
        withMessage,
        "m2",
        "sibling edit",
        "2026-01-04",
        "branch-2",
      ).messages.find((item) => item.id === "m2")?.versions[0].body,
    ).toBe("sibling edit");
    expect(
      deleteModeMessage(withMessage, "m2", "branch-2").messages.map((item) => item.id),
    ).toEqual(["m"]);
  });

  it("rejects duplicate append atomically and normalizes branch relationships/history", () => {
    const message: ModeMessage = {
      id: "m",
      schemaVersion: 1,
      threadId: "thread-1",
      branchId: "branch-1",
      author: { kind: "system", label: "System" },
      versions: [
        {
          id: "v",
          body: "x",
          origin: "generated",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      activeVersionId: "v",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    expect(() => appendModeMessages(thread, [message, message])).toThrow();
    expect(() => appendModeMessages(thread, [{ ...message, threadId: "other" }])).toThrow();
    expect(() => appendModeMessages(thread, [{ ...message, branchId: "branch-2" }])).toThrow();
    expect(() => appendModeMessages(thread, [message], "missing")).toThrow();
    expect(() => appendModeMessages(appendModeMessages(thread, [message]), [message])).toThrow();
    const changed = setModeBranchParticipants(thread, "branch-1", [" c ", "c2"], "2026-01-03");
    expect(changed.branches[0].participantMode).toBe("group");
    expect(changed.branches[0].characterIds).toEqual(["c", "c2"]);
    expect(changed.branches[1].characterIds).toEqual(["d"]);
    const related = setModeBranchProviderConnection(
      setModeBranchLorebooks(
        setModeBranchPersona(changed, "branch-1", " p ", "2026-01-04"),
        "branch-1",
        [" l1 ", "l2"],
        "2026-01-04",
      ),
      "branch-1",
      " provider ",
      "2026-01-04",
    );
    expect(related.branches[0].activePersonaId).toBe("p");
    expect(related.branches[0].lorebookIds).toEqual(["l1", "l2"]);
    expect(related.branches[0].providerConnectionId).toBe("provider");
    expect(related.branches[1].activePersonaId).toBeNull();
    const presetA = setModeBranchPreset(changed, "branch-1", "a", "2026-01-04", {
      block: { kind: "option", optionId: "x" },
    });
    const presetB = setModeBranchPreset(presetA, "branch-1", "b", "2026-01-05", {});
    const back = setModeBranchPreset(presetB, "branch-1", "a", "2026-01-06");
    expect(back.branches[0].presetChoiceSelectionsByPresetId.a).toEqual({
      block: { kind: "option", optionId: "x" },
    });
    expect(back.branches[0].presetChoiceSelectionsByPresetId.b).toEqual({});
    const noActive = {
      ...back,
      branches: back.branches.map((branch) =>
        branch.id === "branch-1" ? { ...branch, presetId: null } : branch,
      ),
    } as typeof back;
    expect(setModeBranchPresetChoiceSelections(noActive, "branch-1", {}, "2026-01-08")).toBe(
      noActive,
    );

    const protoPreset = setModeBranchPreset(changed, "branch-1", "__proto__", "2026-01-09", {});
    expect(
      Object.getPrototypeOf(protoPreset.branches[0].presetChoiceSelectionsByPresetId),
    ).toBeNull();
    expect(
      Object.prototype.hasOwnProperty.call(
        protoPreset.branches[0].presetChoiceSelectionsByPresetId,
        "__proto__",
      ),
    ).toBe(true);
    expect(() => assertValidModeThread(protoPreset)).not.toThrow();
    const updatedProtoPreset = setModeBranchPresetChoiceSelections(
      protoPreset,
      "branch-1",
      { block: { kind: "option", optionId: "y" } },
      "2026-01-10",
    );
    const updatedProtoHistory = updatedProtoPreset.branches[0].presetChoiceSelectionsByPresetId;
    expect(Object.getPrototypeOf(updatedProtoHistory)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(updatedProtoHistory, "__proto__")).toBe(true);

    const reservedWithoutChoices = setModeBranchPreset(
      changed,
      "branch-1",
      "constructor",
      "2026-01-11",
    );
    const reservedHistory = reservedWithoutChoices.branches[0].presetChoiceSelectionsByPresetId;
    expect(Object.getPrototypeOf(reservedHistory)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(reservedHistory, "constructor")).toBe(false);
    expect(reservedHistory.constructor).toBeUndefined();
  });

  it("includes message timestamps even when the active version is older", () => {
    const message: ModeMessage = {
      id: "activity",
      schemaVersion: 1,
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "system", label: "System" },
      versions: [
        { id: "v", body: "x", origin: "manual", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
      ],
      activeVersionId: "v",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-03",
    };
    expect(
      getModeThreadActivityAt({ ...thread, updatedAt: "2026-01-01", messages: [message] }),
    ).toBe("2026-01-03");
  });

  it("orders equivalent and different offsets by instant while preserving stored timestamps", () => {
    const message = createModeMessage({
      id: "activity-offset",
      versionId: "activity-version",
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "system", label: "System" },
      body: "x",
      origin: "manual",
      now: "2026-01-01T08:00:00+11:00",
    });
    const offsetMessage: ModeMessage = {
      ...message,
      updatedAt: "2026-01-01T00:00:00+02:00",
      versions: [{ ...message.versions[0], updatedAt: "2026-01-01T10:00:00+11:00" }],
    };
    const offsetThread: MessengerModeThread = {
      ...thread,
      createdAt: "2025-12-31",
      updatedAt: "2025-12-31T23:00:00Z",
      messages: [offsetMessage],
    };

    expect(getModeThreadActivityAt(offsetThread)).toBe("2025-12-31T23:00:00Z");
    expect(offsetThread.messages[0].updatedAt).toBe("2026-01-01T00:00:00+02:00");
  });

  it("rejects malformed timestamps at creation and validation boundaries", () => {
    expect(() =>
      createModeMessage({
        id: "leap-day",
        versionId: "leap-day-version",
        threadId: thread.id,
        branchId: thread.activeBranchId,
        author: { kind: "system", label: "System" },
        body: "x",
        origin: "manual",
        now: "2024-02-29T23:59:59.999+14:00",
      }),
    ).not.toThrow();
    for (const now of ["2026-02-30", "2025-02-29T00:00:00Z", "2026-04-31T12:00+10:00"]) {
      expect(() =>
        createModeMessage({
          id: "invalid-calendar-date",
          versionId: "invalid-calendar-date-version",
          threadId: thread.id,
          branchId: thread.activeBranchId,
          author: { kind: "system", label: "System" },
          body: "x",
          origin: "manual",
          now,
        }),
      ).toThrow("Invalid mode thread: message timestamp must be a parseable instant");
    }
    expect(() =>
      createModeMessage({
        id: "local-time",
        versionId: "local-time-version",
        threadId: thread.id,
        branchId: thread.activeBranchId,
        author: { kind: "system", label: "System" },
        body: "x",
        origin: "manual",
        now: "2026-01-01T10:00:00",
      }),
    ).toThrow("Invalid mode thread: message timestamp must be a parseable instant");
    expect(() =>
      createModeMessage({
        id: "bad-time",
        versionId: "bad-time-version",
        threadId: thread.id,
        branchId: thread.activeBranchId,
        author: { kind: "system", label: "System" },
        body: "x",
        origin: "manual",
        now: "not-an-instant",
      }),
    ).toThrow("Invalid mode thread: message timestamp must be a parseable instant");
    expect(() => assertValidModeThread({ ...thread, updatedAt: "not-an-instant" })).toThrow(
      "Invalid mode thread: thread updatedAt must be a parseable instant",
    );
  });

  it("rejects updated timestamps before creation for every mode-thread record", () => {
    const message = createModeMessage({
      id: "chronology-message",
      versionId: "chronology-version",
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "system", label: "System" },
      body: "x",
      origin: "manual",
      now: "2026-01-02T00:00:00+01:00",
    });
    const withMessage = { ...thread, messages: [message] };

    expect(() =>
      assertValidModeThread({
        ...withMessage,
        messages: [
          {
            ...message,
            updatedAt: "2026-01-01T23:00:00Z",
            versions: [{ ...message.versions[0], updatedAt: "2026-01-01T23:00:00Z" }],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertValidModeThread({
        ...withMessage,
        createdAt: "2026-01-02T00:00:00+01:00",
        updatedAt: "2026-01-01T23:30:00+01:00",
      }),
    ).toThrow("Invalid mode thread: thread updatedAt must not precede createdAt");
    expect(() =>
      assertValidModeThread({
        ...withMessage,
        branches: [
          {
            ...thread.branches[0],
            createdAt: "2026-01-02T00:00:00+01:00",
            updatedAt: "2026-01-01T22:30:00Z",
          },
          thread.branches[1],
        ],
      }),
    ).toThrow("Invalid mode thread: branch updatedAt must not precede createdAt");
    expect(() =>
      assertValidModeThread({
        ...withMessage,
        messages: [{ ...message, updatedAt: "2026-01-01T22:30:00Z" }],
      }),
    ).toThrow("Invalid mode thread: message updatedAt must not precede createdAt");
    expect(() =>
      assertValidModeThread({
        ...withMessage,
        messages: [
          {
            ...message,
            versions: [{ ...message.versions[0], updatedAt: "2026-01-01T22:30:00Z" }],
          },
        ],
      }),
    ).toThrow("Invalid mode thread: version updatedAt must not precede createdAt");
    expect(() => renameModeThread(thread, "Earlier", "2025-12-31")).toThrow(
      "Invalid mode thread: updatedAt must not precede thread updatedAt",
    );
    expect(() => setModeBranchPersona(thread, "branch-1", "p", "2025-12-31")).toThrow(
      "Invalid mode thread: updatedAt must not precede branch updatedAt",
    );
    expect(() =>
      editActiveModeMessageVersion(withMessage, message.id, "earlier", "2026-01-01T22:30:00Z"),
    ).toThrow("Invalid mode thread: updatedAt must not precede message updatedAt");
  });

  it("rejects mutation timestamps before the current target update", () => {
    const message = createModeMessage({
      id: "monotonic-message",
      versionId: "monotonic-version",
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "system", label: "System" },
      body: "x",
      origin: "manual",
      now: "2026-01-01",
    });
    const messageNewer: MessengerModeThread = {
      ...thread,
      messages: [{ ...message, updatedAt: "2026-01-03" }],
    };
    const versionNewer: MessengerModeThread = {
      ...thread,
      messages: [
        {
          ...message,
          updatedAt: "2026-01-02",
          versions: [{ ...message.versions[0], updatedAt: "2026-01-03" }],
        },
      ],
    };

    expect(() =>
      renameModeThread({ ...thread, updatedAt: "2026-01-03" }, "Later", "2026-01-02"),
    ).toThrow("Invalid mode thread: updatedAt must not precede thread updatedAt");
    expect(() =>
      editActiveModeMessageVersion(messageNewer, message.id, "earlier", "2026-01-02"),
    ).toThrow("Invalid mode thread: updatedAt must not precede message updatedAt");
    expect(() =>
      editActiveModeMessageVersion(versionNewer, message.id, "earlier", "2026-01-02"),
    ).toThrow("Invalid mode thread: updatedAt must not precede active version updatedAt");

    const branchNewer: MessengerModeThread = {
      ...thread,
      branches: [{ ...thread.branches[0], updatedAt: "2026-01-03" }, thread.branches[1]],
    };
    const staleBranchMutations = [
      () => setModeBranchParticipants(branchNewer, "branch-1", ["c2"], "2026-01-02"),
      () => setModeBranchPersona(branchNewer, "branch-1", "p", "2026-01-02"),
      () => setModeBranchLorebooks(branchNewer, "branch-1", ["l"], "2026-01-02"),
      () => setModeBranchPreset(branchNewer, "branch-1", "preset", "2026-01-02"),
      () => setModeBranchPresetChoiceSelections(branchNewer, "branch-1", {}, "2026-01-02"),
      () => setModeBranchProviderConnection(branchNewer, "branch-1", "provider", "2026-01-02"),
    ];
    for (const mutate of staleBranchMutations) {
      expect(mutate).toThrow("Invalid mode thread: updatedAt must not precede branch updatedAt");
    }

    expect(editActiveModeMessageVersion(messageNewer, message.id, " ", "2026-01-03")).toBe(
      messageNewer,
    );
  });

  it("keeps messenger and roleplay discriminators truthful", () => {
    const roleplay = {
      ...thread,
      kind: "roleplay",
      openingCharacterId: null,
      branches: [{ ...thread.branches[0], kind: "roleplay", replyStrategy: "natural" as const }],
    } as RoleplayModeThread;
    expect(assertValidModeThread(roleplay)).toBeUndefined();
    expect(getActiveModeBranch(roleplay).replyStrategy).toBe("natural");
  });

  it("rejects malformed branch/message relationships", () => {
    expect(() => assertValidModeThread({ ...thread, title: "  " })).toThrow();
    expect(() => assertValidModeThread({ ...thread, branches: [] as never })).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], kind: "roleplay" }] as never,
      }),
    ).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], threadId: "other" }, thread.branches[1]],
      }),
    ).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [
          {
            ...thread.branches[0],
            presetChoiceSelectionsByPresetId: { " ": {} },
          },
          thread.branches[1],
        ],
      }),
    ).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [
          {
            ...thread.branches[0],
            presetChoiceSelectionsByPresetId: { preset: { block: "invalid" } as never },
          },
          thread.branches[1],
        ],
      }),
    ).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], characterIds: [" c "] }, thread.branches[1]],
      }),
    ).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        branches: [{ ...thread.branches[0], lorebookIds: ["l", "l"] }, thread.branches[1]],
      }),
    ).toThrow();
    const badMessage: ModeMessage = {
      id: "bad",
      schemaVersion: 1,
      threadId: "thread-1",
      branchId: "branch-1",
      author: { kind: "system", label: "S" },
      versions: [] as never,
      activeVersionId: "missing",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    expect(() => assertValidModeThread({ ...thread, messages: [badMessage] })).toThrow();
    expect(() =>
      assertValidModeThread({
        ...thread,
        messages: [
          {
            ...badMessage,
            versions: [
              {
                id: "present",
                body: "x",
                origin: "manual",
                createdAt: "2026-01-01",
                updatedAt: "2026-01-01",
              },
            ],
          },
        ],
      }),
    ).toThrow();
    expect(() => renameModeThread(thread, "Name", " ")).toThrow();
  });

  it("rejects primitive and nested malformed boundary values with stable errors", () => {
    const cases: unknown[] = [
      null,
      1,
      { ...thread, branches: [null] },
      { ...thread, messages: [{ id: "m" }] },
      {
        ...thread,
        messages: [
          {
            id: "m",
            schemaVersion: 1,
            threadId: thread.id,
            branchId: "branch-1",
            author: null,
            versions: [],
            activeVersionId: "v",
            createdAt: "now",
            updatedAt: "now",
          },
        ],
      },
      {
        ...thread,
        messages: [
          {
            id: "m",
            schemaVersion: 1,
            threadId: thread.id,
            branchId: "branch-1",
            author: { kind: "system", label: "System" },
            versions: [null],
            activeVersionId: "v",
            createdAt: "now",
            updatedAt: "now",
          },
        ],
      },
    ];
    for (const value of cases) {
      expect(() => assertValidModeThread(value)).toThrowError(/^Invalid mode thread:/);
    }
  });
});
