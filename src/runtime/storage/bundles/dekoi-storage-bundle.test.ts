import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createRoleplayThread } from "../../../engine/modes/roleplay/roleplay-actions";
import { createModeMessage } from "../../../engine/modes/mode-thread/mode-thread-actions";
import type { ModeMessage } from "../../../engine/contracts/types/mode-thread";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import {
  createDeKoiStorageBundle,
  createDeKoiStorageBundleFingerprint,
  DEKOI_STORAGE_BUNDLE_KIND,
  normalizeDeKoiStorageBundle,
} from "./dekoi-storage-bundle";
const now = "2026-06-24T07:00:00.000Z";
const thread = createMessengerThread({
  id: "bundle-thread",
  branchId: "bundle-branch",
  title: "Bundle",
  characterIds: [],
  activePersonaId: null,
  now,
});
const msg: ModeMessage = createModeMessage({
  id: "bundle-message",
  versionId: "bundle-message-v1",
  threadId: thread.id,
  branchId: thread.activeBranchId,
  author: { kind: "system", label: "System" },
  body: "hello",
  origin: "manual",
  now,
});
function source() {
  return {
    appSettings: { ...DEFAULT_APP_SETTINGS, defaultPromptPresetId: STARTER_PROMPT_PRESET.id },
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets: [STARTER_PROMPT_PRESET],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [
      {
        id: "provider",
        schemaVersion: 1 as const,
        kind: "provider" as const,
        provider: "custom" as const,
        label: "Local",
        baseUrl: "",
        model: "",
        summary: "",
        status: "ready" as const,
        modelLabel: null,
        agentDefault: false,
        maxContext: null,
        maxOutput: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    modeThreads: [{ ...thread, messages: [msg] }],
    rippleStates: [],
  };
}

describe("DeKoi storage bundle v2", () => {
  it("refuses to export credential-like prompt preset custom fields", () => {
    const unsafePreset = structuredClone(STARTER_PROMPT_PRESET);
    unsafePreset.parameters = {
      ...unsafePreset.parameters,
      customParameters: { password: { send: false, value: "do-not-export" } },
    };

    expect(() => createDeKoiStorageBundle({ ...source(), promptPresets: [unsafePreset] })).toThrow(
      "unsupported generation parameters",
    );
  });

  it("preserves roleplay opening metadata and repairs every branch preset reference", () => {
    const roleplay = createRoleplayThread({
      id: "roleplay-thread",
      branchId: "roleplay-active",
      title: "Roleplay",
      characterIds: ["character-1"],
      activePersonaId: null,
      openingCharacter: { id: "character-1", displayName: "Character" },
      defaultPromptPresetId: "missing-preset",
      now,
    });
    const inactiveBranch = {
      ...roleplay.branches[0],
      id: "roleplay-inactive",
      presetId: "missing-preset",
      presetChoiceSelectionsByPresetId: {
        "missing-preset": { stale: { kind: "option" as const, optionId: "kept" } },
      },
    };
    const sourceData = source();
    const bundle = createDeKoiStorageBundle({
      ...sourceData,
      modeThreads: [{ ...roleplay, branches: [roleplay.branches[0], inactiveBranch] }],
    });
    const parsed = normalizeDeKoiStorageBundle(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const imported = parsed.preview.bundle.data.modeThreads[0];
    expect((imported as typeof roleplay | undefined)?.openingCharacterId).toBe("character-1");
    expect(imported?.branches.map((branch) => branch.presetId)).toEqual([
      STARTER_PROMPT_PRESET.id,
      STARTER_PROMPT_PRESET.id,
    ]);
    expect(imported?.branches[1]?.presetChoiceSelectionsByPresetId).toEqual({
      "missing-preset": { stale: { kind: "option", optionId: "kept" } },
    });
    expect(parsed.preview.warnings.some((warning) => warning.includes("reassigned"))).toBe(true);
  });

  it("round-trips unified mode records with counts and stable fingerprint", () => {
    const bundle = createDeKoiStorageBundle(source());
    const parsed = normalizeDeKoiStorageBundle(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.counts).toMatchObject({
      modeThreads: 1,
      modeMessages: 1,
      providerConnections: 1,
    });
    expect(parsed.preview.bundle.data.modeMessages).toEqual([msg]);
    expect(parsed.preview.fingerprint).toBe(
      createDeKoiStorageBundleFingerprint(parsed.preview.bundle),
    );
  });
  it("skips malformed native prompt presets and restores the existing bundle fallback", () => {
    const bundle = createDeKoiStorageBundle(source());
    const malformedPreset = {
      ...STARTER_PROMPT_PRESET,
      sampling: { temperature: 0.7 },
    };

    const parsed = normalizeDeKoiStorageBundle({
      ...bundle,
      data: { ...bundle.data, promptPresets: [malformedPreset] },
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.bundle.data.promptPresets).toEqual([STARTER_PROMPT_PRESET]);
    expect(parsed.preview.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Prompt presets did not contain valid schema version 1 records"),
        expect.stringContaining("restored the bundled starter preset"),
      ]),
    );
  });
  it("rejects bundles without the required mode message collection", () => {
    const bundle = createDeKoiStorageBundle(source());
    const { modeMessages: _modeMessages, ...data } = bundle.data;
    void _modeMessages;

    expect(normalizeDeKoiStorageBundle({ ...bundle, data })).toEqual({
      ok: false,
      error: "Bundle mode messages are missing or invalid.",
    });
    expect(normalizeDeKoiStorageBundle({ ...bundle, data: { ...data, modeMessages: {} } })).toEqual(
      {
        ok: false,
        error: "Bundle mode messages are missing or invalid.",
      },
    );
  });
  it("excludes provider secrets and warns when imported fields are present", () => {
    const bundle = createDeKoiStorageBundle({
      ...source(),
      providerConnections: [{ ...source().providerConnections[0], apiKey: "secret" } as never],
    });
    expect(bundle.data.providerConnections[0]).not.toHaveProperty("apiKey");
    const parsed = normalizeDeKoiStorageBundle(bundle);
    expect(parsed.ok && parsed.preview.warnings.some((warning) => warning.includes("secret"))).toBe(
      false,
    );
    const raw = {
      ...bundle,
      data: {
        ...bundle.data,
        providerConnections: [{ ...bundle.data.providerConnections[0], apiKey: "secret" }],
      },
    };
    const imported = normalizeDeKoiStorageBundle(raw);
    expect(
      imported.ok && imported.preview.warnings.some((warning) => warning.includes("secret")),
    ).toBe(true);
  });
  it("rejects v1 bundles and warns for invalid/orphan messages and owner state", () => {
    expect(
      normalizeDeKoiStorageBundle({ kind: DEKOI_STORAGE_BUNDLE_KIND, schemaVersion: 1, data: {} })
        .ok,
    ).toBe(false);
    const bundle = createDeKoiStorageBundle({
      ...source(),
      macroVariableStates: [
        {
          id: "valid-state",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: thread.activeBranchId,
          variables: { mood: "calm" },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "orphan-state",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "missing-branch",
          variables: {},
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const parsed = normalizeDeKoiStorageBundle({
      ...bundle,
      data: {
        ...bundle.data,
        modeMessages: [
          { ...msg, threadId: "missing" },
          { ...msg, id: "bad", branchId: "missing" },
        ],
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.bundle.data.modeMessages).toEqual([]);
    expect(
      parsed.preview.warnings.some((warning) => warning.includes("orphan or mismatched")),
    ).toBe(true);
    expect(parsed.preview.bundle.data.macroVariableStates.map((state) => state.id)).toEqual([
      "valid-state",
    ]);
    expect(
      parsed.preview.warnings.some((warning) => warning.includes("without an imported owner")),
    ).toBe(true);
  });

  it("rejects branch IDs duplicated across threads", () => {
    const secondThread = createMessengerThread({
      id: "second-thread",
      branchId: thread.activeBranchId,
      title: "Second",
      characterIds: [],
      activePersonaId: null,
      now,
    });
    const bundle = createDeKoiStorageBundle({
      ...source(),
      modeThreads: [thread, secondThread],
    });

    expect(normalizeDeKoiStorageBundle(bundle)).toEqual({
      ok: false,
      error: `Mode branch ID ${thread.activeBranchId} is duplicated across threads.`,
    });
  });

  it("rejects duplicate thread IDs before normalizing the bundle collection", () => {
    const duplicateThread = createMessengerThread({
      id: thread.id,
      branchId: "second-branch",
      title: "Duplicate",
      characterIds: [],
      activePersonaId: null,
      now,
    });
    const bundle = createDeKoiStorageBundle({
      ...source(),
      modeThreads: [thread, duplicateThread],
    });

    expect(normalizeDeKoiStorageBundle(bundle)).toEqual({
      ok: false,
      error: `Mode thread ID ${thread.id} is duplicated.`,
    });
  });
});
