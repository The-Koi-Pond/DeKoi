import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["ls-files", "--eol", "-z"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  console.error(result.stderr.trim());
  process.exit(result.status ?? 1);
}

const failures = [];
let checked = 0;

for (const record of result.stdout.split("\0")) {
  if (!record) continue;

  const match = record.match(/^i\/(\S*)\s+w\/(\S*)\s+attr\/([^\t]*)\t([\s\S]+)$/);
  if (!match) continue;

  checked += 1;
  const [, , worktreeEnding, attributes, filePath] = match;

  if (worktreeEnding === "mixed") {
    failures.push(`${filePath} has mixed line endings in the working tree.`);
  }

  if (attributes.includes("eol=lf") && worktreeEnding === "crlf") {
    failures.push(`${filePath} has CRLF line endings but should be LF-normalized.`);
  }
}

if (failures.length > 0) {
  console.error("Line-ending check failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("Run `git add --renormalize .` after .gitattributes changes.");
  process.exit(1);
}

console.log(`Line-ending check passed for ${checked} tracked files.`);
