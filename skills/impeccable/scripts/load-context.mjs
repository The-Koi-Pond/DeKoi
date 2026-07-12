/**
 * Shared context loader for every impeccable command that needs to know
 * "who is this for" and "what does this look like".
 *
 * Input: project root (process.cwd()).
 *
 * Output (JSON to stdout):
 *   {
 *     hasProduct: boolean,        // PRODUCT.md found (or auto-migrated)
 *     product: string | null,     // PRODUCT.md contents
 *     productPath: string | null, // relative path
 *     hasDesign: boolean,         // DESIGN.md found
 *     design: string | null,      // DESIGN.md contents
 *     designPath: string | null,
 *     migrated: boolean,          // true if we auto-renamed .impeccable.md -> PRODUCT.md
 *     contextDir: string,         // absolute path of the directory the files were found in
 *   }
 *
 * Filename matching is case-insensitive for PRODUCT.md and DESIGN.md. The
 * Google DESIGN.md convention is uppercase at repo root; Kiro-style and
 * lowercase variants are also matched so users don't get punished for case.
 *
 * Lookup directory resolution (first match wins):
 *   1. process.env.IMPECCABLE_CONTEXT_DIR (absolute or relative to cwd)
 *   2. cwd, if PRODUCT.md / DESIGN.md / .impeccable.md is there (back-compat)
 *   3. Auto-fallback subdirectories of cwd: .agents/context/, then docs/
 *   4. cwd as a default "no context found" location
 *
 * Legacy `.impeccable.md` -> PRODUCT.md migration only fires at cwd root;
 * fallback directories are read-only as far as auto-rename is concerned.
 */

import fs from "node:fs";
import path from "node:path";

const PRODUCT_NAMES = ["PRODUCT.md", "Product.md", "product.md"];
const DESIGN_NAMES = ["DESIGN.md", "Design.md", "design.md"];
const LEGACY_NAMES = [".impeccable.md"];
const FALLBACK_DIRS = [".agents/context", "docs"];

/**
 * Resolve the directory that holds PRODUCT.md / DESIGN.md / DESIGN.json for
 * this project. Exported so other scripts (e.g. live-server.mjs) can read the
 * design files from the same location the loader uses.
 */
export function resolveContextDir(cwd = process.cwd()) {
  // 1. Explicit override
  const envDir = process.env.IMPECCABLE_CONTEXT_DIR;
  if (envDir && envDir.trim()) {
    const trimmed = envDir.trim();
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
  }

  // 2. cwd wins if any canonical or legacy file is there. We check legacy too
  //    so the auto-migration path in loadContext stays predictable.
  if (firstExisting(cwd, [...PRODUCT_NAMES, ...DESIGN_NAMES, ...LEGACY_NAMES])) {
    return cwd;
  }

  // 3. Auto-fallback subdirs. Match if PRODUCT.md or DESIGN.md is present;
  //    legacy `.impeccable.md` does not pull the lookup into a fallback dir.
  for (const rel of FALLBACK_DIRS) {
    const candidate = path.resolve(cwd, rel);
    if (firstExisting(candidate, [...PRODUCT_NAMES, ...DESIGN_NAMES])) {
      return candidate;
    }
  }

  // 4. Nothing found — keep the historical "default to cwd" behaviour so the
  //    caller's `hasProduct === false` branch still fires the same way.
  return cwd;
}

export function loadContext(cwd = process.cwd()) {
  let migrated = false;
  const contextDir = resolveContextDir(cwd);

  // 1. Look for PRODUCT.md (case-insensitive) in the resolved dir
  let productPath = firstExisting(contextDir, PRODUCT_NAMES);

  // 2. Legacy: if no PRODUCT.md but .impeccable.md exists at cwd root, rename
  //    it in place. We only migrate at the root — fallback dirs are read-only
  //    so we don't surprise users by mutating files under docs/ or .agents/.
  if (!productPath && contextDir === cwd) {
    const legacyPath = firstExisting(cwd, LEGACY_NAMES);
    if (legacyPath) {
      const newPath = path.join(cwd, "PRODUCT.md");
      try {
        fs.renameSync(legacyPath, newPath);
        productPath = newPath;
        migrated = true;
      } catch {
        // Rename failed (permissions, etc.) — fall back to reading legacy in place
        productPath = legacyPath;
      }
    }
  }

  // 3. DESIGN.md (case-insensitive)
  const designPath = firstExisting(contextDir, DESIGN_NAMES);

  const product = productPath ? safeRead(productPath) : null;
  const design = designPath ? safeRead(designPath) : null;

  return {
    hasProduct: !!product,
    product,
    productPath: productPath ? path.relative(cwd, productPath) : null,
    hasDesign: !!design,
    design,
    designPath: designPath ? path.relative(cwd, designPath) : null,
    migrated,
    contextDir,
  };
}

function firstExisting(dir, names) {
  for (const name of names) {
    const abs = path.join(dir, name);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

export function listMarkdownSections(markdown) {
  if (!markdown) return [];
  return markdown
    .split(/\r?\n/)
    .map((line) => /^(#{1,6})\s+(.+?)\s*$/.exec(line))
    .filter(Boolean)
    .map((match) => ({ level: match[1].length, heading: match[2] }));
}

export function selectMarkdownSections(markdown, requestedHeadings) {
  if (!markdown || requestedHeadings.length === 0) return null;
  const lines = markdown.split(/\r?\n/);
  const requested = new Set(requestedHeadings.map(normalizeHeading));
  const found = new Set();
  const selected = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match || !requested.has(normalizeHeading(match[2]))) continue;

    found.add(normalizeHeading(match[2]));
    const level = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const next = /^(#{1,6})\s+/.exec(lines[end]);
      if (next && next[1].length <= level) break;
      end += 1;
    }
    selected.push(lines.slice(index, end).join("\n").trimEnd());
  }

  const missing = [...requested].filter((heading) => !found.has(heading));
  if (missing.length > 0) {
    throw new Error(`Missing or mismatched Markdown heading(s): ${missing.join(", ")}`);
  }
  return `${selected.join("\n\n")}\n`;
}

function normalizeHeading(heading) {
  return heading.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function parseCliArgs(args) {
  const options = {
    listSections: false,
    productAll: false,
    productSections: [],
    designSections: [],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--list-sections") options.listSections = true;
    else if (arg === "--product-all") options.productAll = true;
    else if (arg === "--product-section" || arg === "--design-section") {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires an exact heading`);
      const target = arg === "--product-section" ? options.productSections : options.designSections;
      target.push(value);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// CLI mode — print the context as JSON
// ---------------------------------------------------------------------------

function cli() {
  const result = loadContext(process.cwd());
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: node load-context.mjs [options]

Without options, emits the historical full context JSON.

Options:
  --list-sections             List PRODUCT.md and DESIGN.md headings only
  --product-all               Include the complete PRODUCT.md
  --product-section HEADING   Include one exact PRODUCT.md section (repeatable)
  --design-section HEADING    Include one exact DESIGN.md section (repeatable)
  -h, --help                  Show this help`);
    return;
  }
  if (options.listSections) {
    console.log(
      JSON.stringify(
        {
          productPath: result.productPath,
          designPath: result.designPath,
          productSections: listMarkdownSections(result.product),
          designSections: listMarkdownSections(result.design),
          contextDir: result.contextDir,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (options.productAll || options.productSections.length || options.designSections.length) {
    console.log(
      JSON.stringify(
        {
          ...result,
          product: options.productAll
            ? result.product
            : selectMarkdownSections(result.product, options.productSections),
          design: selectMarkdownSections(result.design, options.designSections),
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

const _running = process.argv[1];
if (_running?.endsWith("load-context.mjs") || _running?.endsWith("load-context.mjs/")) {
  try {
    cli();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
