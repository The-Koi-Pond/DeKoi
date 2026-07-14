import { describe, expect, it } from "vitest";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createModeMessage } from "../../../engine/modes/mode-thread/mode-thread-actions";
import { sortMessengerThreads } from "./thread-display";

const old = "2026-07-01T00:00:00.000Z";
const middle = "2026-07-01T12:00:00.000Z";
const recent = "2026-07-02T00:00:00.000Z";

function thread(id: string, messageAt?: string) {
  const value = createMessengerThread({
    id,
    branchId: `${id}-branch`,
    title: id,
    characterIds: [],
    activePersonaId: null,
    now: old,
  });
  return messageAt
    ? {
        ...value,
        messages: [
          createModeMessage({
            id: `${id}-message`,
            versionId: `${id}-version`,
            threadId: id,
            branchId: value.activeBranchId,
            author: { kind: "system", label: "System" },
            body: "Active",
            origin: "manual",
            now: messageAt,
          }),
        ],
      }
    : value;
}

describe("Messenger thread display", () => {
  it("uses canonical message activity for ordering and title tie-breaks", () => {
    const inactive = { ...thread("inactive"), updatedAt: middle };
    const active = thread("active", recent);

    expect(sortMessengerThreads([inactive, active], "freshest")[0]?.id).toBe("active");
    expect(sortMessengerThreads([active, inactive], "oldest")[0]?.id).toBe("inactive");
    expect(
      sortMessengerThreads(
        [
          { ...inactive, title: "Same" },
          { ...active, title: "Same" },
        ],
        "title",
      )[0]?.id,
    ).toBe("active");
  });
});
