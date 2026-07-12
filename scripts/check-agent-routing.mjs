import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixedRoutingFiles = ["AGENTS.md", ".github/agents/dekoi-workflow.md"];
const pathPrefixes = [".github/", "docs/", "scripts/", "skills/", "src/", "src-tauri/", "tests/"];
const rootPathNames = new Set([
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CONTRIBUTING.md",
  "DESIGN.md",
  "DOMAIN_MODEL.md",
  "PRODUCT.md",
  "PROVENANCE.md",
  "README.md",
  "package.json",
]);
const ignoredPnpmWords = new Set(["add", "dlx", "exec", "install", "run"]);

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function listMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdownFiles(entryPath));
    else if (entry.name.endsWith(".md")) files.push(entryPath);
  }
  return files;
}

export function isExactRepoPath(value) {
  const candidate = toPosix(value.trim()).replace(/[.,;:]$/, "");
  if (!candidate || /[*?{}<>$|]/.test(candidate)) return false;
  if (/^(?:https?:|[A-Za-z]:\/|\/)/.test(candidate)) return false;
  if (candidate.includes(" ") || candidate.includes("..")) return false;
  return (
    rootPathNames.has(candidate) || pathPrefixes.some((prefix) => candidate.startsWith(prefix))
  );
}

export function collectInlineRepoPaths(markdown) {
  const paths = [];
  for (const match of markdown.matchAll(/`([^`\r\n]+)`/g)) {
    if (isExactRepoPath(match[1])) paths.push(toPosix(match[1].trim()).replace(/[.,;:]$/, ""));
  }
  return [...new Set(paths)];
}

export function collectPnpmScripts(markdown) {
  const scripts = [];
  for (const match of markdown.matchAll(/\bpnpm\s+(?:run\s+)?([A-Za-z0-9:_-]+)/g)) {
    if (!ignoredPnpmWords.has(match[1])) scripts.push(match[1]);
  }
  return [...new Set(scripts)];
}

export function collectMarkdownLinks(markdown) {
  const links = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    if (/[*?{}<>$|]/.test(target) || path.isAbsolute(target)) continue;
    links.push(target);
  }
  return [...new Set(links)];
}

export function routingFiles() {
  const fixed = fixedRoutingFiles.map((file) => path.join(root, file));
  const skillRoot = path.join(root, "skills");
  const skillEntryPoints = fs
    .readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillRoot, entry.name, "SKILL.md"))
    .filter((file) => fs.existsSync(file));
  const ownedReferences = [
    ...listMarkdownFiles(path.join(skillRoot, "dekoi-architecture-guard", "references")),
    ...listMarkdownFiles(path.join(skillRoot, "dekoi-mode-separation", "references")),
    ...listMarkdownFiles(path.join(skillRoot, "bugfix-discipline", "references")),
  ];
  return [...fixed, ...skillEntryPoints, ...ownedReferences];
}

function routedPathExists(sourceFile, repoPath) {
  const candidates = [path.join(root, repoPath), path.resolve(path.dirname(sourceFile), repoPath)];
  const extensions = [".ts", ".tsx", ".js", ".mjs", ".md"];
  return candidates.some(
    (candidate) =>
      fs.existsSync(candidate) ||
      (!path.extname(candidate) &&
        extensions.some((extension) => fs.existsSync(candidate + extension))),
  );
}

function check() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const packageScripts = new Set(Object.keys(packageJson.scripts ?? {}));
  const failures = [];
  let checkedPaths = 0;
  let checkedScripts = 0;
  let checkedLinks = 0;

  for (const absoluteFile of routingFiles()) {
    const sourceFile = toPosix(path.relative(root, absoluteFile));
    const markdown = fs.readFileSync(absoluteFile, "utf8");

    for (const repoPath of collectInlineRepoPaths(markdown)) {
      checkedPaths += 1;
      if (!routedPathExists(absoluteFile, repoPath)) {
        failures.push(`${sourceFile}: missing routed path \`${repoPath}\``);
      }
    }

    for (const script of collectPnpmScripts(markdown)) {
      checkedScripts += 1;
      if (!packageScripts.has(script)) {
        failures.push(`${sourceFile}: missing package script \`pnpm ${script}\``);
      }
    }

    for (const link of collectMarkdownLinks(markdown)) {
      checkedLinks += 1;
      const target = path.resolve(path.dirname(absoluteFile), link);
      if (!fs.existsSync(target)) {
        failures.push(`${sourceFile}: missing Markdown link \`${link}\``);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Agent routing check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Agent routing check passed: ${checkedPaths} paths, ${checkedScripts} pnpm references, ${checkedLinks} Markdown links.`,
  );
}

const runningFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (runningFile === fileURLToPath(import.meta.url)) check();
