import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/engine/prompt-presets/DeKoiUniversalPreset.json", import.meta.url),
);
const sha256 = createHash("sha256").update(source).digest("hex");

if (source.byteLength !== 40_161) {
  throw new Error(
    `Universal V2 starter size changed: expected 40161, received ${source.byteLength}.`,
  );
}

if (sha256 !== "d55ca242a694f565a5703adfa607385e912b74e043660cacf948f4bf50767878") {
  throw new Error(`Universal V2 starter SHA-256 changed: ${sha256}.`);
}

console.log("Universal V2 starter integrity check passed.");
