import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const toolDir = join(root, ".github", "bunny-review");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
  assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} is missing`);
}

function pythonCandidates() {
  return process.platform === "win32"
    ? [
        ["python"],
        ["py", "-3"],
        ["python3"],
      ]
    : [["python3"], ["python"]];
}

function runPythonCompile() {
  const script = join(toolDir, "bunny_review.py");
  const missing = [];
  const compileSnippet =
    "import pathlib, sys; source = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'); compile(source, sys.argv[1], 'exec')";
  for (const candidate of pythonCandidates()) {
    const [command, ...prefixArgs] = candidate;
    const result = spawnSync(command, [...prefixArgs, "-c", compileSnippet, script], {
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      windowsHide: true,
    });
    if (result.error?.code === "ENOENT") {
      missing.push(candidate.join(" "));
      continue;
    }
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    assert.equal(result.status, 0, `Python compile failed using ${candidate.join(" ")}`);
    return;
  }
  throw new Error(`Unable to compile Bunny Python tooling; missing launchers: ${missing.join(", ")}`);
}

for (const file of [
  ".github/workflows/ci-full.yml",
  ".github/workflows/ci-sanity.yml",
  ".github/workflows/bunny-review.yml",
  ".github/workflows/bunny-review-auto.yml",
  ".github/workflows/bunny-review-command.yml",
  ".github/bunny-review/bunny_review.py",
  ".github/bunny-review/check_guidance_digest.py",
  ".github/bunny-review/ci-checks.json",
  ".github/bunny-review/requirements.txt",
  ".github/bunny-review/reviewer-prompt.md",
  ".github/bunny-review/rules.json",
  ".github/bunny-review/run_guidance_check.mjs",
]) {
  assertFile(file);
}

const checks = JSON.parse(read(".github/bunny-review/ci-checks.json"));
assert.ok(Array.isArray(checks.expected_checks), "ci-checks.json expected_checks must be an array");
const fullWorkflow = read(".github/workflows/ci-full.yml");
for (const check of checks.expected_checks) {
  assert.equal(typeof check.name, "string", "expected check name must be a string");
  assert.match(fullWorkflow, new RegExp(`name:\\s*${check.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
}

const rules = JSON.parse(read(".github/bunny-review/rules.json"));
assert.ok(Array.isArray(rules.review_focus), "rules.json review_focus must be an array");
assert.ok(Array.isArray(rules.path_instructions), "rules.json path_instructions must be an array");
const ruleGuidance = JSON.stringify(rules.path_instructions.flatMap((item) => item.guidance || []));
assert.match(ruleGuidance, /skills\/dekoi-architecture-guard\/SKILL\.md/);
assert.match(ruleGuidance, /skills\/dekoi-mode-separation\/SKILL\.md/);
assert.match(ruleGuidance, /skills\/bugfix-discipline\/SKILL\.md/);

const prompt = read(".github/bunny-review/reviewer-prompt.md");
assert.match(prompt, /source provenance/i);
assert.match(prompt, /FINAL_REVIEW/);
assert.match(prompt, /Calibration: change_summary/);
assert.match(prompt, /multi-chunk review/);

const reviewerTool = read(".github/bunny-review/bunny_review.py");
assert.match(reviewerTool, /BUNNY_RULES_PATH/);

for (const workflow of [
  ".github/workflows/bunny-review-auto.yml",
  ".github/workflows/bunny-review-command.yml",
]) {
  const text = read(workflow);
  assert.doesNotMatch(text, /actions\/checkout/i, `${workflow} must not checkout PR code`);
  assert.doesNotMatch(text, /pnpm install|pip install|cargo check/i, `${workflow} must not install or execute PR code`);
}

const reviewWorkflow = read(".github/workflows/bunny-review.yml");
assert.match(reviewWorkflow, /DEKOI_BUNNY_RUNS_ON/);
assert.match(reviewWorkflow, /DE_KOI_BUNNY_RUNS_ON/);
assert.match(reviewWorkflow, /DEKOI_BUNNY_LLM_API_KEY/);
assert.match(reviewWorkflow, /DE_KOI_BUNNY_LLM_API_KEY/);
assert.match(reviewWorkflow, /DEKOI_BUNNY_LLM_MODEL/);
assert.match(reviewWorkflow, /DE_KOI_BUNNY_LLM_MODEL/);

const autoWorkflow = read(".github/workflows/bunny-review-auto.yml");
assert.match(autoWorkflow, /DEKOI_PR_SYNC_AUTOMATION/);
assert.match(autoWorkflow, /DE_KOI_PR_SYNC_AUTOMATION/);
assert.match(autoWorkflow, /DEKOI_BUNNY_DISPATCH_RUNS_ON/);
assert.match(autoWorkflow, /DE_KOI_BUNNY_DISPATCH_RUNS_ON/);

const commandWorkflow = read(".github/workflows/bunny-review-command.yml");
assert.match(commandWorkflow, /DEKOI_BUNNY_DISPATCH_RUNS_ON/);
assert.match(commandWorkflow, /DE_KOI_BUNNY_DISPATCH_RUNS_ON/);

const fullCiWorkflow = read(".github/workflows/ci-full.yml");
assert.match(fullCiWorkflow, /DEKOI_CI_FULL_MODE/);
assert.match(fullCiWorkflow, /DE_KOI_CI_FULL_MODE/);
assert.match(fullCiWorkflow, /DEKOI_CI_RUNS_ON/);
assert.match(fullCiWorkflow, /DE_KOI_CI_RUNS_ON/);

const sanityWorkflow = read(".github/workflows/ci-sanity.yml");
assert.match(sanityWorkflow, /DEKOI_CI_FULL_MODE/);
assert.match(sanityWorkflow, /DE_KOI_CI_FULL_MODE/);
assert.match(sanityWorkflow, /DEKOI_CI_RUNS_ON/);
assert.match(sanityWorkflow, /DE_KOI_CI_RUNS_ON/);

runPythonCompile();
console.log("bunny_review_check ok");
