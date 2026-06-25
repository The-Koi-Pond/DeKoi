import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsRegistryPath = path.join(root, "src", "shared", "api", "runtime-commands.ts");
const rustRuntimePath = path.join(root, "src-tauri", "src", "runtime.rs");
const fixturePath = path.join(root, "scripts", "remote-runtime-fixture.mjs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseTypeScriptCommands(source) {
  const match = source.match(/export const RUNTIME_COMMANDS = \{([\s\S]*?)\} as const;/);
  if (!match) {
    throw new Error("Could not find RUNTIME_COMMANDS in runtime-commands.ts.");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function parseRustCommands(source) {
  const match = source.match(/match command\.as_str\(\) \{([\s\S]*?)_ => Err/);
  if (!match) {
    throw new Error("Could not find runtime command dispatch in src-tauri/src/runtime.rs.");
  }

  return [...match[1].matchAll(/"([^"]+)"\s*=>/g)].map((item) => item[1]);
}

function parseFixtureCommands(source) {
  const match = source.match(/const SUPPORTED_COMMANDS = new Set\(\[([\s\S]*?)\]\);/);
  if (!match) {
    throw new Error("Could not find SUPPORTED_COMMANDS in remote-runtime-fixture.mjs.");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function unique(values) {
  return [...new Set(values)];
}

function listDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function formatList(values) {
  return values.length ? values.map((value) => `  - ${value}`).join("\n") : "  - none";
}

function compareCommands(label, sourceCommands, targetCommands) {
  const missing = listDifference(sourceCommands, targetCommands);
  const extra = listDifference(targetCommands, sourceCommands);
  const failures = [];

  if (targetCommands.length !== unique(targetCommands).length) {
    failures.push(`${label} contains duplicate command values.`);
  }

  if (missing.length > 0) {
    failures.push(`Commands missing from ${label}:\n${formatList(missing)}`);
  }

  if (extra.length > 0) {
    failures.push(`Commands present only in ${label}:\n${formatList(extra)}`);
  }

  if (
    missing.length === 0 &&
    extra.length === 0 &&
    sourceCommands.join("\n") !== targetCommands.join("\n")
  ) {
    failures.push(`${label} commands match but are in different order.`);
  }

  return failures;
}

const tsCommands = parseTypeScriptCommands(readFile(tsRegistryPath));
const rustCommands = parseRustCommands(readFile(rustRuntimePath));
const fixtureCommands = parseFixtureCommands(readFile(fixturePath));
const failures = [];

if (tsCommands.length !== unique(tsCommands).length) {
  failures.push("TypeScript runtime command registry contains duplicate values.");
}

failures.push(...compareCommands("Rust runtime dispatch", tsCommands, rustCommands));
failures.push(...compareCommands("remote runtime fixture", tsCommands, fixtureCommands));

if (failures.length > 0) {
  console.error("Runtime contract check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Runtime contract check passed for ${tsCommands.length} commands.`);
