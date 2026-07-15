import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/engine/prompt-presets/DeKoiUniversalPreset.json", import.meta.url),
);
const sha256 = createHash("sha256").update(source).digest("hex");

if (source.byteLength !== 39_410) {
  throw new Error(
    `Universal V2 starter size changed: expected 39410, received ${source.byteLength}.`,
  );
}

if (sha256 !== "e1c94f96550fca3073563cff3b099a0db4229aa3ac06080cc46c1bad2a2f1b98") {
  throw new Error(`Universal V2 starter SHA-256 changed: ${sha256}.`);
}

console.log("Universal V2 starter integrity check passed.");
