import { describe, expect, it } from "vitest";

import { normalizePromptPresetImportRecord } from "./prompt-preset-package";

const createdAt = "2026-07-08T00:00:00.000Z";
const exportedAt = "2026-07-11T00:00:00.000Z";

function marinaraPackage(
  preset: Record<string, unknown> = {},
  rows: {
    sections?: unknown[];
    groups?: unknown[];
    choiceBlocks?: unknown[];
  } = {},
) {
  return {
    type: "marinara_preset",
    version: 1,
    exportedAt,
    data: {
      preset: {
        id: "marinara-preset",
        name: "Marinara preset",
        conversationPrompt: "Wire prompt",
        createdAt,
        updatedAt: createdAt,
        ...preset,
      },
      sections: rows.sections ?? [],
      groups: rows.groups ?? [],
      choiceBlocks: rows.choiceBlocks ?? [],
    },
  };
}

describe("Marinara prompt preset packages", () => {
  it("rejects unknown package data fields", () => {
    expect(
      normalizePromptPresetImportRecord({
        ...marinaraPackage(),
        data: { ...marinaraPackage().data, unknownPayload: true },
      }),
    ).toBeNull();
  });

  it("imports compatible package sections without copying them into the shared prompt", () => {
    const record = normalizePromptPresetImportRecord(
      marinaraPackage(
        {
          id: "preset-compatible",
          name: "Compatible Preset",
          conversationPrompt: "Imported Messenger wire prompt.",
          isDefault: true,
          gamePrompt: "Unsupported foreign Game prompt.",
          sectionOrder: ["section-role", "section-history"],
        },
        {
          sections: [
            {
              id: "section-role",
              presetId: "preset-compatible",
              identifier: "role",
              name: "Role",
              content: "Write in character.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              presetId: "preset-compatible",
              identifier: "history",
              name: "History",
              content: "",
              role: "user",
              enabled: true,
              isMarker: true,
              markerConfig: { type: "chat_history" },
            },
          ],
        },
      ),
    );

    expect(record?.messengerPrompt).toBe("Imported Messenger wire prompt.");
    expect(record).not.toHaveProperty("isDefault");
    expect(record).not.toHaveProperty("gamePrompt");
    expect(record?.sections.map((section) => section.presetId)).toEqual([
      "preset-compatible",
      "preset-compatible",
    ]);
  });

  it.each(["schemaVersion", "messengerPrompt"])(
    "rejects DeKoi-only %s in Marinara presets",
    (field) => {
      expect(
        normalizePromptPresetImportRecord(
          marinaraPackage({ [field]: field === "schemaVersion" ? 2 : "wrong field" }),
        ),
      ).toBeNull();
    },
  );

  it("rejects the DeKoi-only choice-block label field", () => {
    expect(
      normalizePromptPresetImportRecord(
        marinaraPackage(
          {},
          {
            choiceBlocks: [
              {
                id: "choice",
                variableName: "tone",
                options: [{ id: "warm", label: "Warm", value: "warm" }],
                label: "Tone",
              },
            ],
          },
        ),
      ),
    ).toBeNull();
  });

  it("rejects the DeKoi-only option description field", () => {
    expect(
      normalizePromptPresetImportRecord(
        marinaraPackage(
          {},
          {
            choiceBlocks: [
              {
                id: "choice",
                variableName: "tone",
                options: [{ id: "warm", label: "Warm", value: "warm", description: "Warm tone" }],
              },
            ],
          },
        ),
      ),
    ).toBeNull();
  });

  it.each([
    [
      "section",
      {
        id: "section",
        identifier: "system",
        name: "System",
        content: "",
        role: "system",
        enabled: true,
        isMarker: false,
        unknown: true,
      },
    ],
    ["group", { id: "group", name: "Group", unknown: true }],
    ["choice block", { id: "choice", variableName: "tone", options: [], unknown: true }],
  ])("rejects an unknown %s field recursively", (_label, row) => {
    const rows =
      _label === "section"
        ? { sections: [row] }
        : _label === "group"
          ? { groups: [row] }
          : { choiceBlocks: [row] };
    expect(normalizePromptPresetImportRecord(marinaraPackage({}, rows))).toBeNull();
  });

  it("rejects unknown nested option, marker, and default-choice fields", () => {
    const validSection = {
      id: "section",
      identifier: "history",
      name: "History",
      content: "",
      role: "user",
      enabled: true,
      isMarker: true,
      markerConfig: { type: "chat_history" },
    };
    const validBlock = {
      id: "choice",
      variableName: "tone",
      options: [{ id: "warm", label: "Warm", value: "warm" }],
    };
    const cases = [
      { sections: [{ ...validSection, markerConfig: { type: "chat_history", unknown: true } }] },
      {
        sections: [
          {
            ...validSection,
            markerConfig: {
              type: "chat_history",
              chatHistoryOptions: { maxMessages: 10, unknown: true },
            },
          },
        ],
      },
      {
        sections: [
          {
            ...validSection,
            markerConfig: {
              type: "chat_history",
              chatHistoryOptions: JSON.stringify({ maxMessages: 10 }),
            },
          },
        ],
      },
      { choiceBlocks: [{ ...validBlock, unknown: true }] },
      {
        choiceBlocks: [
          {
            ...validBlock,
            options: [{ ...validBlock.options[0], unknown: true }],
          },
        ],
      },
      {
        preset: {
          defaultChoices: {
            tone: { kind: "option", optionId: "warm", unknown: true },
          },
        },
      },
    ];

    for (const rows of cases) {
      const { preset, ...packageRows } = rows;
      expect(normalizePromptPresetImportRecord(marinaraPackage(preset, packageRows))).toBeNull();
    }
  });

  it("preserves supported Marinara marker configuration fields", () => {
    const markerConfig = {
      type: "character",
      characterFields: ["name", "description"],
      lorebookFormat: "full",
      chatHistoryOptions: { maxMessages: 12, includeSystemMessages: true },
      agentType: "assistant",
    };
    const record = normalizePromptPresetImportRecord(
      marinaraPackage(
        {},
        {
          sections: [
            {
              id: "section-character",
              identifier: "character",
              name: "Character",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
              markerConfig,
            },
          ],
        },
      ),
    );

    expect(record?.sections[0]?.markerConfig).toEqual(markerConfig);
  });

  it("decodes Marinara JSON columns for marker configuration and choice options", () => {
    const record = normalizePromptPresetImportRecord(
      marinaraPackage(
        {},
        {
          sections: [
            {
              id: "section-history",
              identifier: "history",
              name: "History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
              markerConfig: JSON.stringify({
                type: "chat_history",
                chatHistoryOptions: { maxMessages: 8, includeSystemMessages: false },
              }),
            },
          ],
          choiceBlocks: [
            {
              id: "choice-tone",
              variableName: "tone",
              options: JSON.stringify([{ id: "warm", label: "Warm", value: "warm" }]),
            },
          ],
        },
      ),
    );

    expect(record?.sections[0]?.markerConfig).toEqual({
      type: "chat_history",
      chatHistoryOptions: { maxMessages: 8, includeSystemMessages: false },
    });
    expect(record?.choiceBlocks[0]?.options).toEqual([
      { id: "warm", label: "Warm", value: "warm" },
    ]);
  });

  it("decodes raw Marinara boolean text and preset JSON columns", () => {
    const record = normalizePromptPresetImportRecord(
      marinaraPackage(
        {
          sectionOrder: JSON.stringify(["section"]),
          groupOrder: JSON.stringify(["group"]),
          variableGroups: JSON.stringify([]),
          variableValues: JSON.stringify({ base: "grounded" }),
          defaultChoices: JSON.stringify({ tone: "warm" }),
        },
        {
          sections: [
            {
              id: "section",
              identifier: "role",
              name: "Role",
              content: "Write in character.",
              role: "system",
              enabled: "true",
              isMarker: "false",
              wrapInXml: "true",
              forbidOverrides: "false",
            },
          ],
          groups: [{ id: "group", name: "Group", enabled: "false" }],
          choiceBlocks: [
            {
              id: "choice-tone",
              variableName: "tone",
              multiSelect: "false",
              randomPick: "true",
              options: JSON.stringify([{ id: "warm", label: "Warm", value: "warm" }]),
            },
          ],
        },
      ),
    );

    expect(record).toMatchObject({
      sectionOrder: ["section"],
      groupOrder: ["group"],
      variableGroups: [],
      variableValues: { base: "grounded" },
      defaultChoices: { tone: "warm" },
      sections: [
        {
          enabled: true,
          isMarker: false,
          wrapInXml: true,
          forbidOverrides: false,
        },
      ],
      groups: [{ enabled: false }],
      choiceBlocks: [{ multiSelect: false, randomPick: true }],
    });
  });

  it("normalizes a marker-only Marinara package to an empty shared prompt", () => {
    const record = normalizePromptPresetImportRecord(
      marinaraPackage(
        {
          id: "preset-marker-only",
          name: "Marker-only Preset",
          conversationPrompt: "   ",
          sectionOrder: ["section-history"],
        },
        {
          sections: [
            {
              id: "section-history",
              identifier: "history",
              name: "History",
              content: "",
              role: "user",
              enabled: true,
              isMarker: true,
              markerConfig: { type: "chat_history" },
            },
          ],
        },
      ),
    );

    expect(record?.messengerPrompt).toBe("");
  });
});
