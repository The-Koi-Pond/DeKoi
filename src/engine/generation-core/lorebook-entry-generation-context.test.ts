import { describe, expect, it } from "vitest";

import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import { activateLorebookEntriesWithWarnings } from "./lorebook-activation";
import { loreEntryMatchesGenerationContext } from "./lorebook-entry-generation-context";

const now = "2026-07-02T00:00:00.000Z";

function entry(input: Partial<Parameters<typeof createLorebookEntryRecord>[0]["input"]>) {
  return createLorebookEntryRecord({
    id: input.title ?? "entry-under-test",
    input: { title: input.title ?? "Entry", body: input.body ?? "Entry body.", ...input },
    now,
  });
}

describe("lorebook entry generation context", () => {
  it("matches trigger restrictions while treating empty restrictions as unrestricted", () => {
    const unrestricted = entry({ title: "Unrestricted" });
    const normalOnly = entry({ title: "Normal", triggers: { types: ["normal"] } });
    const empty = entry({ title: "Empty", triggers: { types: [] } });

    expect(
      loreEntryMatchesGenerationContext(unrestricted, {
        generationTrigger: "regenerate",
        targetCharacterId: null,
      }),
    ).toBe(true);
    expect(
      loreEntryMatchesGenerationContext(normalOnly, {
        generationTrigger: "normal",
        targetCharacterId: null,
      }),
    ).toBe(true);
    expect(
      loreEntryMatchesGenerationContext(normalOnly, {
        generationTrigger: "regenerate",
        targetCharacterId: null,
      }),
    ).toBe(false);
    expect(
      loreEntryMatchesGenerationContext(empty, {
        generationTrigger: "regenerate",
        targetCharacterId: null,
      }),
    ).toBe(true);
  });

  it("applies trigger restrictions to direct and recursive activation", () => {
    const directBlocked = entry({
      title: "Direct blocked",
      key: ["gate"],
      triggers: { types: ["regenerate"] },
    });
    const recursionStarter = entry({
      title: "Recursion starter",
      key: ["gate"],
      body: "Hidden sigil.",
    });
    const recursiveBlocked = entry({
      title: "Recursive blocked",
      key: ["hidden sigil"],
      triggers: { types: ["regenerate"] },
    });
    const baseLorebook = createLorebookRecord({
      id: "lorebook-under-test",
      input: { title: "Lore" },
      now,
    });
    const lorebook = {
      ...baseLorebook,
      activation: {
        ...baseLorebook.activation,
        recursiveScan: true,
      },
      entries: [directBlocked, recursionStarter, recursiveBlocked],
    };

    const result = activateLorebookEntriesWithWarnings(lorebook, "Open the gate.", {
      generationTrigger: "normal",
    });

    expect(result.entries.map(({ entry: activatedEntry }) => activatedEntry.title)).toEqual([
      "Recursion starter",
    ]);
  });

  it("matches include and exclude filters against only the current target", () => {
    const include = entry({ characterFilter: { mode: "include", characterIds: ["mara"] } });
    const exclude = entry({ characterFilter: { mode: "exclude", characterIds: ["mara"] } });
    const empty = entry({ characterFilter: { mode: "include", characterIds: [] } });

    expect(
      loreEntryMatchesGenerationContext(include, {
        generationTrigger: null,
        targetCharacterId: "mara",
      }),
    ).toBe(true);
    expect(
      loreEntryMatchesGenerationContext(include, {
        generationTrigger: null,
        targetCharacterId: "other",
      }),
    ).toBe(false);
    expect(
      loreEntryMatchesGenerationContext(exclude, {
        generationTrigger: null,
        targetCharacterId: "mara",
      }),
    ).toBe(false);
    expect(
      loreEntryMatchesGenerationContext(exclude, {
        generationTrigger: null,
        targetCharacterId: null,
      }),
    ).toBe(true);
    expect(
      loreEntryMatchesGenerationContext(empty, {
        generationTrigger: null,
        targetCharacterId: "other",
      }),
    ).toBe(true);
  });

  it("blocks sticky activation without mutating its timer for an excluded target", () => {
    const filtered = entry({
      title: "Filtered sticky",
      characterFilter: { mode: "include", characterIds: ["mara"] },
      timing: { sticky: 3, cooldown: 0, delay: 0 },
    });
    const lorebook = {
      ...createLorebookRecord({ id: "lorebook-under-test", input: { title: "Lore" }, now }),
      entries: [filtered],
    };
    const runtimeState: LoreRuntimeState = {
      id: "runtime-state",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: "branch-1",
      lastEvaluatedMessageCount: 0,
      entries: [
        {
          lorebookId: lorebook.id,
          entryId: filtered.id,
          entryUpdatedAt: filtered.updatedAt,
          activatedAtMessageIndex: 0,
          stickyRemaining: 2,
          cooldownRemaining: 0,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const result = activateLorebookEntriesWithWarnings(lorebook, "", {
      messageCount: 1,
      runtimeState,
      targetCharacterId: "other",
    });

    expect(result.entries).toEqual([]);
    expect(result.runtimeState?.entries).toEqual(runtimeState.entries);
  });
});
