import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT,
  updatePromptPresetRecord,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import { promptPresetHasEnabledMarker } from "../../../engine/prompt-presets/prompt-preset-section-policy";
import {
  canSavePromptPresetDraft,
  createPromptPresetDraftSection,
  draftFromPromptPreset,
  movePromptPresetDraftSection,
  promptPresetDraftToInput,
  removePromptPresetDraftGroup,
  updatePromptPresetDraftSectionKind,
  updatePromptPresetDraftSectionMarkerType,
} from "./prompt-preset-draft";

const now = "2026-07-08T00:00:00.000Z";

function promptPresetRecord(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Structured Preset",
    summary: null,
    systemPrompt: "Fallback prompt.",
    messengerPrompt: null,
    sampling: null,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    wrapFormat: null,
    isDefault: false,
    author: null,
    folderId: null,
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

describe("prompt preset draft conversion", () => {
  it("keeps structured sections and groups in editable order", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sectionOrder: ["section-history", "section-role"],
        groupOrder: ["group-context"],
        wrapFormat: "markdown",
        sections: [
          {
            id: "section-role",
            identifier: "role",
            name: "Role",
            content: "Stay in character.",
            role: "system",
            enabled: true,
            isMarker: false,
            groupId: "group-context",
          },
          {
            id: "section-history",
            identifier: "chat_history",
            name: "Chat History",
            content: "",
            role: "user",
            enabled: true,
            isMarker: true,
            markerConfig: { type: "chat_history" },
          },
        ],
        groups: [{ id: "group-context", name: "Context", enabled: true }],
      }),
    );

    expect(draft.sections.map((section) => section.id)).toEqual([
      "section-history",
      "section-role",
    ]);
    expect(draft.groups.map((group) => group.id)).toEqual(["group-context"]);

    const input = promptPresetDraftToInput(draft);

    expect(input.sectionOrder).toEqual(["section-history", "section-role"]);
    expect(input.groupOrder).toEqual(["group-context"]);
    expect(input.wrapFormat).toBe("markdown");
    expect(input.sections).toEqual([
      {
        id: "section-history",
        identifier: "chat_history",
        name: "Chat History",
        content: "",
        role: "user",
        enabled: true,
        isMarker: true,
        markerConfig: { type: "chat_history" },
      },
      {
        id: "section-role",
        identifier: "role",
        name: "Role",
        content: "Stay in character.",
        role: "system",
        enabled: true,
        isMarker: false,
        groupId: "group-context",
      },
    ]);
  });

  it("lets the engine preserve compatible hidden fields while editing visible fields", () => {
    const record = promptPresetRecord({
      parameters: { topK: 40, temperature: 0.8 },
      sampling: { temperature: 0.8 },
      variableOrder: ["choice-tone"],
      variableGroups: [{ id: "group-tone" }],
      variableValues: { style: "cinematic" },
      defaultChoices: { tone: { kind: "option", optionId: "warm" } },
      isDefault: true,
      author: "Preset Author",
      folderId: "folder-a",
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          defaultOptionId: "warm",
          options: [{ id: "warm", label: "Warm", value: "warm prose" }],
        },
      ],
    });
    const draft = draftFromPromptPreset(record);
    draft.title = "Edited Preset";

    const input = promptPresetDraftToInput(draft);
    const updated = updatePromptPresetRecord(record, input, "2026-07-08T01:00:00.000Z");

    expect(input.title).toBe("Edited Preset");
    expect(input).not.toHaveProperty("parameters");
    expect(input).not.toHaveProperty("variableGroups");
    expect(input).not.toHaveProperty("variableValues");
    expect(input).not.toHaveProperty("isDefault");
    expect(input).not.toHaveProperty("author");
    expect(input).not.toHaveProperty("folderId");
    expect(input.variableOrder).toEqual(["choice-tone"]);
    expect(input.defaultChoices).toEqual({
      tone: { kind: "option", optionId: "warm" },
    });
    expect(input.choiceBlocks).toEqual(record.choiceBlocks);
    expect(updated).toMatchObject({
      title: "Edited Preset",
      parameters: { topK: 40, temperature: 0.8 },
      variableOrder: ["choice-tone"],
      variableGroups: [{ id: "group-tone" }],
      variableValues: { style: "cinematic" },
      defaultChoices: { tone: { kind: "option", optionId: "warm" } },
      isDefault: true,
      author: "Preset Author",
      folderId: "folder-a",
      choiceBlocks: record.choiceBlocks,
    });
  });

  it("removes deleted group references and reorders sections explicitly", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sections: [
          {
            id: "section-a",
            identifier: "a",
            name: "A",
            content: "A",
            role: "system",
            enabled: true,
            isMarker: false,
            groupId: "group-a",
          },
          {
            id: "section-b",
            identifier: "b",
            name: "B",
            content: "B",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [
          { id: "group-a", name: "Group A", enabled: false },
          {
            id: "group-child",
            name: "Child Group",
            enabled: true,
            parentGroupId: "group-a",
          },
        ],
      }),
    );

    const withoutGroup = removePromptPresetDraftGroup(draft, "group-a");
    const movedSections = movePromptPresetDraftSection(withoutGroup.sections, "section-b", -1);
    const input = promptPresetDraftToInput({ ...withoutGroup, sections: movedSections });

    expect(input.groups).toEqual([{ id: "group-child", name: "Child Group", enabled: true }]);
    expect(input.sectionOrder).toEqual(["section-b", "section-a"]);
    expect(input.sections?.[1]).not.toHaveProperty("groupId");
  });

  it("matches assembler fallback order before writing an explicit section order", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sectionOrder: [],
        sections: [
          {
            id: "section-late",
            identifier: "late",
            name: "Late",
            content: "Late",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionOrder: 20,
          },
          {
            id: "section-early",
            identifier: "early",
            name: "Early",
            content: "Early",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionOrder: 1,
          },
        ],
      }),
    );

    expect(draft.sections.map((section) => section.id)).toEqual(["section-early", "section-late"]);
    expect(promptPresetDraftToInput(draft).sectionOrder).toEqual(["section-early", "section-late"]);
  });

  it("sorts sections missing from a partial section order by injection order", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sectionOrder: ["section-pinned"],
        sections: [
          {
            id: "section-late",
            identifier: "late",
            name: "Late",
            content: "Late",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionOrder: 20,
          },
          {
            id: "section-pinned",
            identifier: "pinned",
            name: "Pinned",
            content: "Pinned",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionOrder: 99,
          },
          {
            id: "section-early",
            identifier: "early",
            name: "Early",
            content: "Early",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionOrder: 1,
          },
        ],
      }),
    );

    expect(draft.sections.map((section) => section.id)).toEqual([
      "section-pinned",
      "section-early",
      "section-late",
    ]);
    expect(promptPresetDraftToInput(draft).sectionOrder).toEqual([
      "section-pinned",
      "section-early",
      "section-late",
    ]);
  });

  it("clamps structured section depth to a non-negative integer on save", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sections: [
          {
            id: "section-depth",
            identifier: "depth",
            name: "Depth",
            content: "Depth note.",
            role: "system",
            enabled: true,
            isMarker: false,
            injectionDepth: -2.7,
            injectionPosition: "at-depth",
          },
        ],
      }),
    );

    expect(promptPresetDraftToInput(draft).sections?.[0]?.injectionDepth).toBe(0);
  });

  it("preserves section content and identity while toggling marker state before save", () => {
    const section = {
      ...createPromptPresetDraftSection("section"),
      content: "Do not lose this draft text.",
      identifier: "role",
    };

    const marker = updatePromptPresetDraftSectionKind(section, "marker");
    const restoredSection = updatePromptPresetDraftSectionKind(marker, "section");

    expect(marker).toMatchObject({
      content: "Do not lose this draft text.",
      identifier: "role",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
    expect(restoredSection).toMatchObject({
      content: "Do not lose this draft text.",
      identifier: "role",
      isMarker: false,
      markerConfig: null,
    });

    const savedMarkerInput = promptPresetDraftToInput({
      ...draftFromPromptPreset(promptPresetRecord()),
      sections: [marker],
    });

    expect(savedMarkerInput.sections?.[0]).toMatchObject({
      content: "",
      identifier: "chat_history",
      markerConfig: { type: "chat_history" },
    });

    const savedRestoredInput = promptPresetDraftToInput({
      ...draftFromPromptPreset(promptPresetRecord()),
      sections: [restoredSection],
    });

    expect(savedRestoredInput.sections?.[0]?.identifier).toBe("role");
  });

  it("preserves section identity while selecting a marker type", () => {
    const section = {
      ...createPromptPresetDraftSection("section"),
      identifier: "role",
    };
    const marker = updatePromptPresetDraftSectionMarkerType(
      updatePromptPresetDraftSectionKind(section, "marker"),
      "chat_summary",
    );
    const restoredSection = updatePromptPresetDraftSectionKind(marker, "section");

    expect(marker).toMatchObject({
      identifier: "role",
      markerConfig: { type: "chat_summary" },
    });
    expect(restoredSection).toMatchObject({
      identifier: "role",
      isMarker: false,
      markerConfig: null,
    });

    const savedMarkerInput = promptPresetDraftToInput({
      ...draftFromPromptPreset(promptPresetRecord()),
      sections: [marker],
    });

    expect(savedMarkerInput.sections?.[0]).toMatchObject({
      identifier: "chat_summary",
      markerConfig: { type: "chat_summary" },
    });
  });

  it("normalizes unsupported marker types before save", () => {
    const marker = {
      ...createPromptPresetDraftSection("marker"),
      identifier: "role",
      markerConfig: { type: "role" },
    };

    const input = promptPresetDraftToInput({
      ...draftFromPromptPreset(promptPresetRecord()),
      sections: [marker],
    });

    expect(input.sections?.[0]).toMatchObject({
      identifier: "chat_history",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
  });

  it("drops XML tag names from marker sections before save", () => {
    const draft = draftFromPromptPreset(
      promptPresetRecord({
        sections: [
          {
            id: "section-marker",
            identifier: "stale_marker_identifier",
            name: "Chat Summary",
            content: "Hidden marker content.",
            role: "system",
            enabled: true,
            isMarker: true,
            markerConfig: { type: "chat_summary" },
            wrapInXml: true,
            xmlTagName: "stale_tag",
          },
          {
            id: "section-text",
            identifier: "role",
            name: "Role",
            content: "Visible text content.",
            role: "system",
            enabled: true,
            isMarker: false,
            wrapInXml: true,
            xmlTagName: "role_tag",
          },
        ],
      }),
    );

    const input = promptPresetDraftToInput(draft);

    expect(input.sections?.[0]).not.toHaveProperty("xmlTagName");
    expect(input.sections?.[0]?.identifier).toBe("chat_summary");
    expect(input.sections?.[1]?.xmlTagName).toBe("role_tag");
  });

  it("allows saving a titled draft with system prompt or structured sections", () => {
    const draft = draftFromPromptPreset(promptPresetRecord());

    expect(
      canSavePromptPresetDraft({
        ...draft,
        title: "Roleplay Sections",
        systemPrompt: "",
        sections: [createPromptPresetDraftSection("section")],
      }),
    ).toBe(true);
    expect(
      canSavePromptPresetDraft({
        ...draft,
        title: "Marker Only",
        systemPrompt: "",
        sections: [createPromptPresetDraftSection("marker")],
      }),
    ).toBe(true);
    expect(
      promptPresetDraftToInput({
        ...draft,
        title: "Marker Only",
        systemPrompt: "",
        sections: [createPromptPresetDraftSection("marker")],
      }).systemPrompt,
    ).toBe(DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT);
    expect(
      canSavePromptPresetDraft({
        ...draft,
        title: "System Prompt",
        systemPrompt: "Fallback prompt.",
        sections: [],
      }),
    ).toBe(true);
    expect(
      canSavePromptPresetDraft({
        ...draft,
        title: "Empty Preset",
        systemPrompt: "",
        sections: [],
      }),
    ).toBe(false);
    expect(
      canSavePromptPresetDraft({
        ...draft,
        title: "",
        systemPrompt: "Fallback prompt.",
        sections: [createPromptPresetDraftSection("section")],
      }),
    ).toBe(false);
  });

  it("detects only effectively enabled Chat History markers for transcript insertion", () => {
    const section = createPromptPresetDraftSection("section");
    const disabledMarker = {
      ...createPromptPresetDraftSection("marker"),
      enabled: false,
    };
    const enabledMarker = createPromptPresetDraftSection("marker");
    const groupedMarker = {
      ...enabledMarker,
      groupId: "group-off",
    };

    expect(promptPresetHasEnabledMarker([section], [], "chat_history")).toBe(false);
    expect(promptPresetHasEnabledMarker([disabledMarker], [], "chat_history")).toBe(false);
    expect(promptPresetHasEnabledMarker([section, enabledMarker], [], "chat_history")).toBe(true);
    expect(
      promptPresetHasEnabledMarker(
        [groupedMarker],
        [{ id: "group-off", name: "Disabled", enabled: false }],
        "chat_history",
      ),
    ).toBe(false);
  });

  it("submits the engine fallback when a section-only draft clears the system prompt", () => {
    const record = promptPresetRecord({
      systemPrompt: "Old prompt that should not survive.",
      sections: [
        {
          id: "section-role",
          identifier: "role",
          name: "Role",
          content: "Stay in character.",
          role: "system",
          enabled: true,
          isMarker: false,
        },
      ],
    });
    const input = promptPresetDraftToInput({
      ...draftFromPromptPreset(record),
      systemPrompt: "   ",
    });

    expect(input.systemPrompt).toBe(DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT);

    const updated = updatePromptPresetRecord(record, input, "2026-07-08T01:00:00.000Z");

    expect(updated.systemPrompt).toBe(DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT);
  });

  it("preserves compatible variable-order slots while choices move or disappear", () => {
    const record = promptPresetRecord({
      variableOrder: [
        "compatible-before",
        "choice-tone",
        "compatible-middle",
        "choice-style",
        "compatible-after",
      ],
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [{ id: "tone-warm", label: "Warm", value: "warm" }],
        },
        {
          id: "choice-style",
          variableName: "style",
          label: "Style",
          options: [{ id: "style-direct", label: "Direct", value: "direct" }],
        },
      ],
    });
    const draft = draftFromPromptPreset(record);

    expect(
      promptPresetDraftToInput({
        ...draft,
        choiceBlocks: [draft.choiceBlocks[1]!, draft.choiceBlocks[0]!],
      }).variableOrder,
    ).toEqual([
      "compatible-before",
      "choice-style",
      "compatible-middle",
      "choice-tone",
      "compatible-after",
    ]);
    expect(
      promptPresetDraftToInput({
        ...draft,
        choiceBlocks: [draft.choiceBlocks[1]!],
      }).variableOrder,
    ).toEqual(["compatible-before", "compatible-middle", "choice-style", "compatible-after"]);
  });
});
