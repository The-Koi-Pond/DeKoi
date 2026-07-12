import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/engine/prompt-presets/DeKoiUniversalPreset.json", import.meta.url),
);
const sha256 = createHash("sha256").update(source).digest("hex");

if (source.byteLength !== 40_225) {
  throw new Error(
    `Universal V2 starter size changed: expected 40225, received ${source.byteLength}.`,
  );
}

if (sha256 !== "975ec5eb2f4fa1043e5b9683db366068278c15ef556734eb240a61f9cf4591ab") {
  throw new Error(`Universal V2 starter SHA-256 changed: ${sha256}.`);
}

console.log("Universal V2 starter integrity check passed.");
