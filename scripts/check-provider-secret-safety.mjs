import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  console.error(`Provider secret safety check failed. ${message}`);
  process.exit(1);
}

function interfaceBody(source, name) {
  const match = source.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) fail(`Could not find ${name}.`);
  return match[1];
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function assertSameFields(actual, expected, message) {
  const actualFields = sortedUnique(actual);
  const expectedFields = sortedUnique(expected);
  if (JSON.stringify(actualFields) === JSON.stringify(expectedFields)) return;

  const missing = expectedFields.filter((field) => !actualFields.includes(field));
  const extra = actualFields.filter((field) => !expectedFields.includes(field));
  fail(
    `${message} Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
  );
}

function interfaceFields(source, name) {
  return [...interfaceBody(source, name).matchAll(/^\s+([A-Za-z]\w*)\??:/gm)].map(
    (match) => match[1],
  );
}

function exportedObjectKeys(source, name) {
  const match = source.match(
    new RegExp(
      `export const ${name} = \\{([\\s\\S]*?)\\n\\} as const satisfies Record<keyof ProviderConnectionRecord, true>;`,
    ),
  );
  if (!match) fail(`Could not find ${name}.`);
  return [...match[1].matchAll(/^\s+([A-Za-z]\w*):\s*true,/gm)].map(
    (field) => field[1],
  );
}

function exportedFunctionBody(source, name) {
  const signatureIndex = source.indexOf(`export function ${name}`);
  if (signatureIndex === -1) fail(`Could not find ${name}.`);
  const bodyStart = source.indexOf("{", signatureIndex);
  if (bodyStart === -1) fail(`Could not find ${name} body.`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  fail(`Could not parse ${name} body.`);
}

function firstReturnedObjectKeys(source, name) {
  const body = exportedFunctionBody(source, name);
  const returnIndex = body.indexOf("return {");
  if (returnIndex === -1) fail(`Could not find ${name} returned object.`);
  const objectStart = body.indexOf("{", returnIndex);

  let depth = 0;
  for (let index = objectStart; index < body.length; index += 1) {
    const char = body[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      const objectBody = body.slice(objectStart + 1, index);
      return [...objectBody.matchAll(/^\s{4}([A-Za-z]\w*)(?=\s*[:,])/gm)].map(
        (match) => match[1],
      );
    }
  }

  fail(`Could not parse ${name} returned object.`);
}

const providerConnectionSource = readFile("src/engine/provider-connection.ts");
const providerConnectionActionsSource = readFile(
  "src/engine/provider-connection-actions.ts",
);
const providerConnectionStorageSource = readFile(
  "src/runtime/storage/collections/provider-connection-storage.ts",
);
const bundleSource = readFile(
  "src/runtime/storage/bundles/dekoi-storage-bundle.ts",
);

const providerConnectionRecordBody = interfaceBody(
  providerConnectionSource,
  "ProviderConnectionRecord",
);
const providerConnectionRecordFields = interfaceFields(
  providerConnectionSource,
  "ProviderConnectionRecord",
);
const durableProviderConnectionFields = exportedObjectKeys(
  providerConnectionSource,
  "PROVIDER_CONNECTION_DURABLE_FIELD_SET",
);
assertSameFields(
  durableProviderConnectionFields,
  providerConnectionRecordFields,
  "Provider connection durable field set must match ProviderConnectionRecord exactly.",
);
assertSameFields(
  firstReturnedObjectKeys(providerConnectionSource, "sanitizeProviderConnectionRecord"),
  providerConnectionRecordFields,
  "Provider connection sanitizer output must match ProviderConnectionRecord exactly.",
);
if (/\bapiKey\s*:/.test(providerConnectionRecordBody)) {
  fail("ProviderConnectionRecord must not include durable apiKey.");
}

if (!/\bapiKey\?\s*:/.test(interfaceBody(providerConnectionActionsSource, "ProviderConnectionInput"))) {
  fail("ProviderConnectionInput should remain the explicit typed-secret boundary.");
}

if (/\.\.\.record/.test(providerConnectionSource)) {
  fail("Provider connection sanitizer must not spread input records.");
}

if (/apiKey\s*:/.test(providerConnectionStorageSource)) {
  fail("Provider connection storage adapter must not write apiKey fields.");
}

if (
  !/preserveReadyStatus/.test(providerConnectionStorageSource) ||
  !/getDesktopProviderSecretStatus/.test(providerConnectionStorageSource) ||
  !/provider: record\.provider/.test(providerConnectionStorageSource) ||
  !/baseUrl: record\.baseUrl/.test(providerConnectionStorageSource) ||
  !/storedProviderConnectionRepository\.save/.test(providerConnectionStorageSource) ||
  !/status\.hasSecret[\s\S]*\{ \.\.\.record, status: "needs-key" \}/.test(
    providerConnectionStorageSource,
  ) ||
  !/verificationErrors\.push/.test(providerConnectionStorageSource) ||
  !/secretVerification/.test(providerConnectionStorageSource) ||
  !/persistedStatus: record\.status/.test(providerConnectionStorageSource) ||
  /catch \(error\)[\s\S]{0,600}status: "needs-key"/.test(
    providerConnectionStorageSource,
  ) ||
  !/PROVIDER_CONNECTION_DURABLE_FIELDS/.test(providerConnectionStorageSource) ||
  !/PROVIDER_CONNECTION_DURABLE_FIELD_SET/.test(
    providerConnectionStorageSource,
  ) ||
  !/assertProviderConnectionDurableRecord/.test(providerConnectionStorageSource) ||
  !/Object\.keys\(record\)\.sort\(\)/.test(providerConnectionStorageSource) ||
  !/missing\.length > 0 \|\| extra\.length > 0/.test(
    providerConnectionStorageSource,
  ) ||
  !/normalizeProviderConnectionRecord\(record, \{\s*preserveReadyStatus: true,/m.test(
    providerConnectionStorageSource,
  ) ||
  !/Object\.is\(record\[field\], normalized\[field\]\)/.test(
    providerConnectionStorageSource,
  ) ||
  !/sanitizeProviderConnectionRecord\(record\)/.test(
    providerConnectionStorageSource,
  ) ||
  !/Object\.defineProperty\(verifiedRecord, "secretVerification"/.test(
    providerConnectionStorageSource,
  ) ||
  !/enumerable: false/.test(providerConnectionStorageSource) ||
  !/records\.map\(durableProviderConnectionRecord\)/.test(
    providerConnectionStorageSource,
  )
) {
  fail("Desktop provider connection readiness must keep verification overlays non-durable and assert the exact durable save record.");
}

if (!/redactProviderConnectionSecrets\(providerConnections\)/.test(bundleSource)) {
  fail("createDeKoiStorageBundle must redact provider connection secrets.");
}

if (/\.\.\.sanitizeProviderConnectionRecord/.test(bundleSource)) {
  fail("Provider connection bundle export must not spread sanitized records.");
}

if (!/providerOption\.apiKeyRequired \? "needs-key" : sanitized\.status/.test(bundleSource)) {
  fail("Provider connection bundle export must require key re-entry for redacted secrets.");
}

if (!/Provider connections skipped secret field\(s\)/.test(bundleSource)) {
  fail("normalizeDeKoiStorageBundle must warn when imported provider secrets are skipped.");
}

const desktopRuntimeSource = readFile("src-tauri/src/runtime.rs");
if (/provider_secret_read_for_scope\([^)]*true\)/.test(desktopRuntimeSource)) {
  fail("Desktop runtime provider secret reads must not use unscoped fallback.");
}

if (
  !/get\("status"\)/.test(desktopRuntimeSource) ||
  !/status != "ready"/.test(desktopRuntimeSource) ||
  !/return Ok\(String::new\(\)\);/.test(desktopRuntimeSource)
) {
  fail("Desktop runtime must only read keyring secrets for ready connections.");
}

if (
  !/provider_connection_requires_api_key\(provider\)/.test(desktopRuntimeSource) ||
  !/Some\(secret\) if !secret\.trim\(\)\.is_empty\(\) => Ok\(secret\)/.test(
    desktopRuntimeSource,
  ) ||
  !/Provider connection needs an API key before it can make provider requests/.test(
    desktopRuntimeSource,
  )
) {
  fail("Required-key provider requests must fail when the stored desktop secret is missing.");
}

const providerConnectionActionSource = readFile(
  "src/features/catalog/actions/use-provider-connection-actions.ts",
);
if (
  !/existingConnection\?\.provider === input\.provider/.test(
    providerConnectionActionSource,
  ) ||
  !/existingConnection\.baseUrl\.trim\(\)\.replace/.test(
    providerConnectionActionSource,
  )
) {
  fail("Provider secret reuse must be scoped to the same provider and base URL.");
}

const providerConnectionSurfaceSource = readFile(
  "src/features/catalog/connections/ConnectionsSurface.tsx",
);
if (
  !/canUseStoredDesktopSecret/.test(providerConnectionSurfaceSource) ||
  !/getDesktopProviderSecretStatus\(editingId/.test(providerConnectionSurfaceSource) ||
  !/storedSecretStatus === "available"/.test(providerConnectionSurfaceSource) ||
  !/activeConnection\?\.status === "ready"/.test(providerConnectionSurfaceSource) ||
  !/normalizedDraft\.provider === normalizedInitialDraft\.provider/.test(
    providerConnectionSurfaceSource,
  ) ||
  !/\.\.\.input[\s\S]*id: editingId \?\? undefined[\s\S]*status: activeConnection\?\.status/.test(
    providerConnectionSurfaceSource,
  )
) {
  fail("Provider connection check must scope saved desktop secret reuse to unchanged ready records.");
}

const providerGenerationSource = readFile(
  "src/features/runtime/generation/provider-generation.ts",
);
if (
  !/providerOption\.apiKeyRequired && connection\.status !== "ready"/.test(
    providerGenerationSource,
  ) ||
  !/Provider connection needs an API key before it can generate/.test(
    providerGenerationSource,
  )
) {
  fail("Desktop provider generation must fail locally for non-ready required-key connections.");
}

console.log("Provider secret safety check passed.");
