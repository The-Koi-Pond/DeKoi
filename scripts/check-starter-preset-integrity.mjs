import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/engine/prompt-presets/DeKoiUniversalPreset.json", import.meta.url),
);
const sha256 = createHash("sha256").update(source).digest("hex");

if (source.byteLength !== 39_137) {
  throw new Error(
    `Universal V2 starter size changed: expected 39137, received ${source.byteLength}.`,
  );
}

if (sha256 !== "eefc3759e23cd4ea505f06baa5fcf5485c1f055b1db9b9c9a0aa4e91579c4b17") {
  throw new Error(`Universal V2 starter SHA-256 changed: ${sha256}.`);
}

console.log("Universal V2 starter integrity check passed.");
