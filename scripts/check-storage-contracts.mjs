import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsRegistryPath = path.join(root, "src", "runtime", "storage-entities.ts");
const rustHostPath = path.join(root, "src-tauri", "src", "storage.rs");
const storageDocsPath = path.join(root, "docs", "storage-model.md");

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
    throw new Error("Could not find COLLECTION_ENTITIES in src-tauri/src/storage.rs.");
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

function parseDocumentedCollections(source) {
  const sectionMatch = source.match(
    /## Current Collections\s+([\s\S]*?)\n## Source Of Truth/,
  );
  if (!sectionMatch) {
    throw new Error("Could not find Current Collections table in docs/storage-model.md.");
  }

  return [...sectionMatch[1].matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/gm)].map(
    (match) => ({
      entity: match[1],
      ownerPath: match[2],
      recordName: match[3],
    }),
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
const documentedCollections = parseDocumentedCollections(readFile(storageDocsPath));
const documentedEntities = documentedCollections.map((collection) => collection.entity);
const failures = [];

if (tsEntities.length !== unique(tsEntities).length) {
  failures.push("TypeScript storage entity registry contains duplicate values.");
}

if (rustEntities.length !== unique(rustEntities).length) {
  failures.push("Rust collection allowlist contains duplicate values.");
}

if (documentedEntities.length !== unique(documentedEntities).length) {
  failures.push("Storage model documentation contains duplicate collection rows.");
}

const missingInRust = listDifference(tsEntities, rustEntities);
const missingInTypeScript = listDifference(rustEntities, tsEntities);
const missingInDocs = listDifference(tsEntities, documentedEntities);
const extraInDocs = listDifference(documentedEntities, tsEntities);
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

if (missingInDocs.length > 0) {
  failures.push(
    `Entities present in TypeScript but missing from docs/storage-model.md:\n${formatList(missingInDocs)}`,
  );
}

if (extraInDocs.length > 0) {
  failures.push(
    `Entities present in docs/storage-model.md but missing from TypeScript:\n${formatList(extraInDocs)}`,
  );
}

if (
  missingInRust.length === 0 &&
  missingInTypeScript.length === 0 &&
  tsEntities.join("\n") !== rustEntities.join("\n")
) {
  failures.push("TypeScript and Rust storage entities match but are in different order.");
}

if (
  missingInDocs.length === 0 &&
  extraInDocs.length === 0 &&
  tsEntities.join("\n") !== documentedEntities.join("\n")
) {
  failures.push("TypeScript and documented storage entities match but are in different order.");
}

for (const collection of documentedCollections) {
  const ownerPath = path.join(root, collection.ownerPath);
  if (!fs.existsSync(ownerPath)) {
    failures.push(
      `Documented storage owner does not exist for ${collection.entity}: ${collection.ownerPath}`,
    );
    continue;
  }

  const ownerSource = readFile(ownerPath);
  if (!new RegExp(`\\b${collection.recordName}\\b`).test(ownerSource)) {
    failures.push(
      `Documented record ${collection.recordName} was not found in ${collection.ownerPath}.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Storage contract check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(
  `Storage contract check passed for ${tsEntities.length} entities and ${documentedCollections.length} documented collections.`,
);
