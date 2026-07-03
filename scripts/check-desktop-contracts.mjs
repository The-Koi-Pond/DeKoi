import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsRegistryPath = path.join(root, "src", "shared", "api", "desktop-commands.ts");
const rustLibPath = path.join(root, "src-tauri", "src", "lib.rs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseTypeScriptCommands(source) {
  const objectMatch = source.match(/export const DESKTOP_COMMANDS = \{([\s\S]*?)\} as const;/);
  if (!objectMatch) {
    throw new Error("Could not find DESKTOP_COMMANDS in desktop-commands.ts.");
  }

  const valuesByKey = new Map();
  for (const match of objectMatch[1].matchAll(/(\w+):\s*"([^"]+)"/g)) {
    valuesByKey.set(match[1], match[2]);
  }

  const allowlistMatch = source.match(
    /export const DESKTOP_COMMAND_ALLOWLIST = \[([\s\S]*?)\] as const/,
  );
  if (!allowlistMatch) {
    throw new Error("Could not find DESKTOP_COMMAND_ALLOWLIST in desktop-commands.ts.");
  }

  return [...allowlistMatch[1].matchAll(/DESKTOP_COMMANDS\.(\w+)/g)].map((match) => {
    const value = valuesByKey.get(match[1]);
    if (!value) {
      throw new Error(`DESKTOP_COMMAND_ALLOWLIST references unknown ${match[1]}.`);
    }
    return value;
  });
}

function parseRustCommands(source) {
  const match = source.match(/tauri::generate_handler!\[([\s\S]*?)\]/);
  if (!match) {
    throw new Error("Could not find generate_handler! command list in src-tauri/src/lib.rs.");
  }

  return [...match[1].matchAll(/(?:\w+::)?(dekoi_[a-z_]+)/g)].map((item) => item[1]);
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

const tsCommands = parseTypeScriptCommands(readFile(tsRegistryPath));
const rustCommands = parseRustCommands(readFile(rustLibPath));
const failures = [];

if (tsCommands.length !== unique(tsCommands).length) {
  failures.push("TypeScript desktop command allowlist contains duplicate values.");
}

if (rustCommands.length !== unique(rustCommands).length) {
  failures.push("Rust Tauri command registration contains duplicate values.");
}

const missingInRust = listDifference(tsCommands, rustCommands);
const missingInTypeScript = listDifference(rustCommands, tsCommands);

if (missingInRust.length > 0) {
  failures.push(
    `Commands present in TypeScript but missing from Rust:\n${formatList(missingInRust)}`,
  );
}

if (missingInTypeScript.length > 0) {
  failures.push(
    `Commands present in Rust but missing from TypeScript:\n${formatList(missingInTypeScript)}`,
  );
}

if (
  missingInRust.length === 0 &&
  missingInTypeScript.length === 0 &&
  tsCommands.join("\n") !== rustCommands.join("\n")
) {
  failures.push("TypeScript and Rust desktop commands match but are in different order.");
}

if (failures.length > 0) {
  console.error("Desktop command contract check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Desktop command contract check passed for ${tsCommands.length} commands.`);
