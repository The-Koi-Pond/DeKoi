import assert from "node:assert/strict";
import test from "node:test";

import { listMarkdownSections, selectMarkdownSections } from "./load-context.mjs";

const markdown = `# Design

Preamble.

## Core

Core text.

### Detail

Detail text.

## Surface

Surface text.
`;

test("lists headings without document bodies", () => {
  assert.deepEqual(listMarkdownSections(markdown), [
    { level: 1, heading: "Design" },
    { level: 2, heading: "Core" },
    { level: 3, heading: "Detail" },
    { level: 2, heading: "Surface" },
  ]);
});

test("selects a section and its descendants without adjacent sections", () => {
  const selected = selectMarkdownSections(markdown, ["Core"]);
  assert.match(selected, /Core text/);
  assert.match(selected, /Detail text/);
  assert.doesNotMatch(selected, /Surface text/);
});

test("fails instead of silently loading everything for a missing heading", () => {
  assert.throws(
    () => selectMarkdownSections(markdown, ["Missing"]),
    /Missing or mismatched Markdown heading/,
  );
});
