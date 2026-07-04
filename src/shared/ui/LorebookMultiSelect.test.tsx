import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LorebookMultiSelect } from "./LorebookMultiSelect";

function renderLorebookMultiSelect({
  lorebooks = [],
  selectedLorebookIds = [],
}: {
  lorebooks?: { id: string; title: string }[];
  selectedLorebookIds?: string[];
}) {
  return renderToStaticMarkup(
    <LorebookMultiSelect
      emptyMessage="No lorebooks available."
      idPrefix="test-lorebook"
      label="Lorebooks"
      lorebooks={lorebooks}
      selectedLorebookIds={selectedLorebookIds}
      onChange={() => {}}
    />,
  );
}

describe("LorebookMultiSelect", () => {
  it("renders missing selected IDs with a remove affordance", () => {
    const html = renderLorebookMultiSelect({
      lorebooks: [{ id: "saved-lore", title: "Saved Lore" }],
      selectedLorebookIds: ["saved-lore", "missing-lore"],
    });

    expect(html).toContain("Saved Lore");
    expect(html).toContain("Missing lorebook: missing-lore");
    expect(html).toContain('aria-label="Remove missing lorebook missing-lore"');
    expect(html).toContain(">Remove</button>");
  });

  it("renders missing selected IDs when no saved lorebooks exist", () => {
    const html = renderLorebookMultiSelect({
      selectedLorebookIds: ["missing-lore"],
    });

    expect(html).toContain("Missing lorebook: missing-lore");
    expect(html).not.toContain("No lorebooks available.");
  });
});
