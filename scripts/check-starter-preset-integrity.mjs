import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/engine/prompt-presets/DeKoiUniversalPreset.json", import.meta.url),
);
const sha256 = createHash("sha256").update(source).digest("hex");

if (source.byteLength !== 39_559) {
  throw new Error(
    `Universal V2 starter size changed: expected 39559, received ${source.byteLength}.`,
  );
}

if (sha256 !== "9a99c1da79bbec2ba10ebcf2e6b257d201a00d1e4974b2672ebe5712267bad98") {
  throw new Error(`Universal V2 starter SHA-256 changed: ${sha256}.`);
}

console.log("Universal V2 starter integrity check passed.");
