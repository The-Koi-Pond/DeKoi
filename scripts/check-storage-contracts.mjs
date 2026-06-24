import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsRegistryPath = path.join(root, "src", "runtime", "storage-entities.ts");
const rustHostPath = path.join(root, "src-tauri", "src", "lib.rs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseTypeScriptEntities(source) {
  const match = source.match(
    /export const HOST_STORAGE_ENTITIES = \[([\s\S]*?)\] as const;/,
  );
  if (!match) {
    throw new Error("Could not find HOST_STORAGE_ENTITIES in storage-entities.ts.");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function parseRustEntities(source) {
  const constants = new Map();
  for (const match of source.matchAll(
    /const\s+([A-Z_]+_ENTITY):\s*&str\s*=\s*"([^"]+)";/g,
  )) {
    constants.set(match[1], match[2]);
  }

  const collectionMatch = source.match(
    /const COLLECTION_ENTITIES:\s*&\[\&str\]\s*=\s*&\[([\s\S]*?)\];/,
  );
  if (!collectionMatch) {
    throw new Error("Could not find COLLECTION_ENTITIES in src-tauri/src/lib.rs.");
  }

  return [...collectionMatch[1].matchAll(/\b[A-Z_]+_ENTITY\b/g)].map(
    (match) => {
      const value = constants.get(match[0]);
      if (!value) {
        throw new Error(`COLLECTION_ENTITIES references unknown ${match[0]}.`);
      }
      return value;
    },
  );
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

const tsEntities = parseTypeScriptEntities(readFile(tsRegistryPath));
const rustEntities = parseRustEntities(readFile(rustHostPath));
const failures = [];

if (tsEntities.length !== unique(tsEntities).length) {
  failures.push("TypeScript storage entity registry contains duplicate values.");
}

if (rustEntities.length !== unique(rustEntities).length) {
  failures.push("Rust collection allowlist contains duplicate values.");
}

const missingInRust = listDifference(tsEntities, rustEntities);
const missingInTypeScript = listDifference(rustEntities, tsEntities);
if (missingInRust.length > 0) {
  failures.push(
    `Entities present in TypeScript but missing from Rust:\n${formatList(missingInRust)}`,
  );
}

if (missingInTypeScript.length > 0) {
  failures.push(
    `Entities present in Rust but missing from TypeScript:\n${formatList(missingInTypeScript)}`,
  );
}

if (
  missingInRust.length === 0 &&
  missingInTypeScript.length === 0 &&
  tsEntities.join("\n") !== rustEntities.join("\n")
) {
  failures.push("TypeScript and Rust storage entities match but are in different order.");
}

if (failures.length > 0) {
  console.error("Storage contract check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Storage contract check passed for ${tsEntities.length} entities.`);
