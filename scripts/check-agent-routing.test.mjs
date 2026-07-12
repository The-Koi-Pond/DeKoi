import assert from "node:assert/strict";
import test from "node:test";

import {
  collectInlineRepoPaths,
  collectMarkdownLinks,
  collectPnpmScripts,
  isExactRepoPath,
  routingFiles,
} from "./check-agent-routing.mjs";

test("recognizes exact repository paths and Windows separators", () => {
  assert.equal(isExactRepoPath("src/features/modes/messenger"), true);
  assert.equal(isExactRepoPath("skills\\tdd\\SKILL.md"), true);
  assert.equal(isExactRepoPath("PRODUCT.md"), true);
});

test("ignores globs, placeholders, URLs, private paths, and scratch", () => {
  for (const value of [
    "skills/*/references/*",
    "src/<owner>/file.ts",
    "https://example.com/file.md",
    "C:\\DeKoi-context\\secret.md",
    "scratch/proof.json",
  ]) {
    assert.equal(isExactRepoPath(value), false, value);
  }
});

test("extracts only exact inline paths", () => {
  assert.deepEqual(
    collectInlineRepoPaths(
      "Use `src/engine/index.ts`, ignore `src/*`, and read `skills\\tdd\\SKILL.md`.",
    ),
    ["src/engine/index.ts", "skills/tdd/SKILL.md"],
  );
});

test("extracts pnpm script names without treating exec as a script", () => {
  assert.deepEqual(
    collectPnpmScripts("Run `pnpm check` and `pnpm run lint`; use pnpm exec prettier."),
    ["check", "lint"],
  );
});

test("extracts local Markdown links and ignores URLs and anchors", () => {
  assert.deepEqual(
    collectMarkdownLinks("[local](reference/a.md) [web](https://example.com) [section](#part)"),
    ["reference/a.md"],
  );
});

test("third-party reference manuals are outside the routing scan", () => {
  const files = routingFiles().map((file) => file.replaceAll("\\", "/"));
  assert.equal(
    files.some((file) => file.endsWith("/skills/impeccable/SKILL.md")),
    true,
  );
  assert.equal(
    files.some((file) => file.endsWith("/skills/impeccable/reference/live.md")),
    false,
  );
  assert.equal(
    files.some((file) =>
      file.endsWith("/skills/dekoi-mode-separation/references/mode-impact-map.md"),
    ),
    true,
  );
});
