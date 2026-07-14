import { describe, expect, it } from "vitest";

import type { DeKoiLegacyImportData } from "../../../runtime";
import { restampLegacyImportData } from "./legacy-import-commit";

const now = "2026-07-06T00:00:00.000Z";

describe("restampLegacyImportData", () => {
  it("restamps canonical records and remaps every relationship", () => {
    const sourceThreadId = "legacy-thread";
    const sourceBranchId = "legacy-branch";
    const sourceMessageId = "legacy-message";
    const sourceVersionId = "legacy-version";
    const threadVariables = {
      id: "legacy-thread-variables",
      schemaVersion: 1 as const,
      ownerKind: "mode-branch" as const,
      ownerId: sourceThreadId,
      variables: { mood: "calm" },
      createdAt: now,
      updatedAt: now,
    };
    const data: DeKoiLegacyImportData = {
      sourceLabel: "Legacy DeKoi export",
      characters: [
        {
          id: "legacy-character",
          lorebookIds: ["foreign"],
        } as DeKoiLegacyImportData["characters"][number],
      ],
      personas: [
        {
          id: "legacy-persona",
          lorebookIds: ["foreign"],
        } as DeKoiLegacyImportData["personas"][number],
      ],
      providerConnections: [
        { id: "legacy-provider" } as DeKoiLegacyImportData["providerConnections"][number],
      ],
      macroVariableStates: [
        {
          id: "legacy-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { weather: "rain" },
          createdAt: now,
          updatedAt: now,
        },
        threadVariables,
      ],
      messengerThreadMacroVariableStates: [threadVariables],
      messengerThreads: [],
      modeThreads: [
        {
          id: sourceThreadId,
          schemaVersion: 1,
          kind: "messenger",
          title: "Imported thread",
          activeBranchId: sourceBranchId,
          branches: [
            {
              id: sourceBranchId,
              schemaVersion: 1,
              threadId: sourceThreadId,
              kind: "messenger",
              participantMode: "group",
              characterIds: ["legacy-character", "missing-character"],
              activePersonaId: "legacy-persona",
              lorebookIds: [],
              presetId: null,
              presetChoiceSelectionsByPresetId: {},
              providerConnectionId: "legacy-provider",
              systemPromptMode: "default",
              systemPrompt: "",
              createdAt: now,
              updatedAt: now,
            },
          ],
          messages: [
            {
              id: sourceMessageId,
              schemaVersion: 1,
              threadId: sourceThreadId,
              branchId: sourceBranchId,
              author: { kind: "character", characterId: "legacy-character", label: "Mara" },
              versions: [
                {
                  id: sourceVersionId,
                  body: "Hello.",
                  origin: "imported",
                  createdAt: now,
                  updatedAt: now,
                },
              ],
              activeVersionId: sourceVersionId,
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    let nextId = 0;
    const prepared = restampLegacyImportData(data, (prefix) => `${prefix}-fresh-${nextId++}`);
    const thread = prepared.modeThreads[0]!;
    const branch = thread.branches[0]!;
    const message = prepared.modeThreads[0]!.messages[0]!;
    const version = message.versions[0]!;

    expect(thread.id).toBe("mode-thread-fresh-4");
    expect(branch.id).toBe("mode-branch-fresh-5");
    expect(message.id).toBe("mode-message-fresh-8");
    expect(version.id).toBe("mode-version-fresh-7");
    expect(new Set([thread.id, branch.id, message.id, version.id]).size).toBe(4);
    expect(thread.activeBranchId).toBe(branch.id);
    expect(message.threadId).toBe(thread.id);
    expect(message.branchId).toBe(branch.id);
    expect(message.activeVersionId).toBe(version.id);
    expect(thread.messages).toEqual([message]);
    expect(branch.characterIds).toEqual([prepared.characters[0]!.id]);
    expect(branch.participantMode).toBe("direct");
    expect(branch.activePersonaId).toBe(prepared.personas[0]!.id);
    expect(branch.providerConnectionId).toBe(prepared.providerConnections[0]!.id);
    expect(prepared.characters[0]!.lorebookIds).toEqual([]);
    expect(prepared.personas[0]!.lorebookIds).toEqual([]);
    expect(message.author).toEqual({
      kind: "character",
      characterId: prepared.characters[0]!.id,
      label: "Mara",
    });
    expect(prepared.macroVariableStates).toEqual([
      expect.objectContaining({ ownerKind: "global", ownerId: "global" }),
      expect.objectContaining({ ownerKind: "mode-branch", ownerId: branch.id }),
    ]);
  });

  it("keeps duplicate source thread messages positional and clears foreign references", () => {
    const makeThread = (label: string): DeKoiLegacyImportData["modeThreads"][number] => ({
      id: "duplicate",
      schemaVersion: 1 as const,
      kind: "messenger" as const,
      title: label,
      activeBranchId: `${label}-branch`,
      branches: [
        {
          id: `${label}-branch`,
          schemaVersion: 1 as const,
          threadId: "duplicate",
          kind: "messenger" as const,
          participantMode: "direct" as const,
          characterIds: [],
          activePersonaId: null,
          lorebookIds: ["foreign-lore"],
          presetId: "foreign-preset",
          presetChoiceSelectionsByPresetId: {
            old: { tone: { kind: "option" as const, optionId: "x" } },
          },
          providerConnectionId: null,
          systemPromptMode: "default" as const,
          systemPrompt: "",
          createdAt: now,
          updatedAt: now,
        },
      ],
      messages: [
        {
          id: `${label}-message`,
          schemaVersion: 1 as const,
          threadId: "duplicate",
          branchId: `${label}-branch`,
          author: { kind: "system" as const, label },
          versions: [
            {
              id: `${label}-version`,
              body: label,
              origin: "imported" as const,
              createdAt: now,
              updatedAt: now,
            },
          ],
          activeVersionId: `${label}-version`,
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const data = {
      sourceLabel: "legacy",
      characters: [],
      personas: [],
      providerConnections: [],
      macroVariableStates: [],
      messengerThreadMacroVariableStates: [null, null],
      messengerThreads: [],
      modeThreads: [makeThread("first"), makeThread("second")],
    } satisfies DeKoiLegacyImportData;
    let next = 0;
    const result = restampLegacyImportData(data, (prefix) => `${prefix}-${next++}`);
    expect(result.modeThreads.map((thread) => thread.messages[0]?.versions[0]?.body)).toEqual([
      "first",
      "second",
    ]);
    expect(result.modeThreads.every((thread) => thread.branches[0]?.lorebookIds.length === 0)).toBe(
      true,
    );
    expect(
      result.modeThreads.every(
        (thread) =>
          thread.branches[0]?.presetId === null &&
          Object.keys(thread.branches[0]?.presetChoiceSelectionsByPresetId ?? {}).length === 0,
      ),
    ).toBe(true);
  });
});
