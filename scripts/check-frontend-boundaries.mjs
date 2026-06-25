import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcRoot = path.join(root, "src");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const ignoredDirectoryNames = new Set([".git", "dist", "node_modules", "target"]);
const featureLayerRank = new Map([
  ["catalog", 0],
  ["runtime", 1],
  ["modes", 2],
  ["shell", 3],
]);
const catalogResourcePackageNames = new Set([
  "companions",
  "lorebooks",
  "personas",
]);
const allowedFeatureRoots = new Set([
  ...featureLayerRank.keys(),
  "navigation",
]);

function isCatalogRootSourceFile(filePath) {
  return /^src\/features\/catalog\/[^/]+\.[jt]sx?$/.test(filePath);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isUnder(filePath, directoryPath) {
  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function getFeatureLayer(filePath) {
  const match = filePath.match(/^src\/features\/([^/]+)/);
  if (!match || !featureLayerRank.has(match[1])) return null;
  return match[1];
}

function getCatalogResourcePackageRoot(filePath) {
  const match = filePath.match(/^src\/features\/catalog\/([^/]+)/);
  if (!match || !catalogResourcePackageNames.has(match[1])) return null;
  return `src/features/catalog/${match[1]}`;
}

function listSourceFiles(directoryPath) {
  const files = [];

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (ignoredDirectoryNames.has(entry.name)) continue;

    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(entryPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectModuleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveRelativeImport(sourceFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  const absoluteTarget = path.resolve(root, path.dirname(sourceFile), specifier);
  return toPosix(path.relative(root, absoluteTarget));
}

function isReactPackage(specifier) {
  return specifier === "react" || specifier.startsWith("react/");
}

function isTauriPackage(specifier) {
  return specifier === "@tauri-apps/api" || specifier.startsWith("@tauri-apps/");
}

function describeImport(sourceFile, specifier, targetFile) {
  return `${sourceFile} imports ${specifier}${targetFile ? ` (${targetFile})` : ""}`;
}

function checkImport(sourceFile, specifier, targetFile) {
  const failures = [];
  const sourceIsApp = isUnder(sourceFile, "src/app");
  const sourceIsEngine = isUnder(sourceFile, "src/engine");
  const sourceIsRuntime = isUnder(sourceFile, "src/runtime");
  const sourceIsShared = isUnder(sourceFile, "src/shared");
  const sourceIsSharedApi = isUnder(sourceFile, "src/shared/api");
  const sourceIsGenericShared = sourceIsShared && !sourceIsSharedApi;
  const sourceIsNavigation = isUnder(sourceFile, "src/features/navigation");
  const sourceIsFeature = isUnder(sourceFile, "src/features");
  const sourceIsFeatureRuntime = isUnder(sourceFile, "src/features/runtime");
  const sourceIsNonNavigationFeature = sourceIsFeature && !sourceIsNavigation;
  const sourceFeatureLayer = getFeatureLayer(sourceFile);
  const sourceCatalogResourcePackageRoot =
    getCatalogResourcePackageRoot(sourceFile);

  if (sourceIsEngine && (isReactPackage(specifier) || isTauriPackage(specifier))) {
    failures.push("Engine modules must stay React-free and host-free.");
  }

  if (sourceIsRuntime && isReactPackage(specifier)) {
    failures.push("Runtime adapters must stay React-free.");
  }

  if (sourceIsRuntime && isTauriPackage(specifier)) {
    failures.push("Runtime adapters must use shared API wrappers for Tauri host checks.");
  }

  if (sourceIsFeatureRuntime && isReactPackage(specifier)) {
    failures.push("Feature runtime workflows must stay React-free.");
  }

  if (!targetFile) return failures;

  if (
    sourceIsEngine &&
    (isUnder(targetFile, "src/runtime") ||
      isUnder(targetFile, "src/app") ||
      isUnder(targetFile, "src/features") ||
      isUnder(targetFile, "src/shared"))
  ) {
    failures.push("Engine modules must not import app, runtime, feature, or shared frontend modules.");
  }

  if (
    sourceIsApp &&
    (isUnder(targetFile, "src/runtime") || isUnder(targetFile, "src/engine"))
  ) {
    failures.push("App composition must not import runtime adapters or engine modules directly.");
  }

  if (sourceIsRuntime && (isUnder(targetFile, "src/app") || isUnder(targetFile, "src/features"))) {
    failures.push("Runtime adapters must not import app composition or React feature modules.");
  }

  if (sourceIsRuntime && targetFile === "src/shared/api/desktop-commands") {
    failures.push("Runtime adapters must use shared API wrappers instead of the desktop command catalog.");
  }

  if (sourceIsShared && (isUnder(targetFile, "src/app") || isUnder(targetFile, "src/features"))) {
    failures.push("Shared modules must not import app composition or feature modules.");
  }

  if (sourceIsSharedApi && isUnder(targetFile, "src/runtime")) {
    failures.push("Shared API wrappers must not import runtime bridge modules.");
  }

  if (
    sourceIsGenericShared &&
    (isUnder(targetFile, "src/runtime") || isUnder(targetFile, "src/engine"))
  ) {
    failures.push("Generic shared helpers must not import runtime adapters or engine modules.");
  }

  const targetFeatureLayer = getFeatureLayer(targetFile);
  const targetCatalogResourcePackageRoot =
    getCatalogResourcePackageRoot(targetFile);
  if (sourceFeatureLayer && targetFeatureLayer) {
    const sourceRank = featureLayerRank.get(sourceFeatureLayer);
    const targetRank = featureLayerRank.get(targetFeatureLayer);
    if (targetRank > sourceRank) {
      failures.push(
        "Old-shape feature layer direction must be shell -> modes -> runtime -> catalog.",
      );
    }
  }

  if (sourceIsFeature && isUnder(targetFile, "src/app")) {
    failures.push("Feature modules must not import app composition modules.");
  }

  if (
    targetCatalogResourcePackageRoot &&
    targetFile !== targetCatalogResourcePackageRoot &&
    sourceCatalogResourcePackageRoot !== targetCatalogResourcePackageRoot
  ) {
    failures.push("Catalog resource packages must be imported through their public entrypoints.");
  }

  if (sourceIsFeatureRuntime && isUnder(targetFile, "src/features/navigation")) {
    failures.push("Feature runtime workflows must not import navigation orchestration.");
  }

  if (
    sourceIsNavigation &&
    isUnder(targetFile, "src/features") &&
    !isUnder(targetFile, "src/features/navigation") &&
    !isUnder(targetFile, "src/features/runtime")
  ) {
    failures.push("Navigation orchestration must not import sibling feature UI modules.");
  }

  if (sourceIsNavigation && isUnder(targetFile, "src/runtime")) {
    failures.push("Navigation orchestration must route runtime bridge imports through features/runtime.");
  }

  if (
    sourceIsNonNavigationFeature &&
    sourceFeatureLayer !== "runtime" &&
    isUnder(targetFile, "src/runtime")
  ) {
    failures.push("Shell, mode, and catalog features must route runtime bridge imports through features/runtime.");
  }

  return failures;
}

const sourceFiles = listSourceFiles(srcRoot).map((filePath) =>
  toPosix(path.relative(root, filePath)),
);
const failures = [];
const unknownFeatureRoots = new Set();

for (const sourceFile of sourceFiles) {
  const featureRootMatch = sourceFile.match(/^src\/features\/([^/]+)/);
  if (featureRootMatch && !allowedFeatureRoots.has(featureRootMatch[1])) {
    unknownFeatureRoots.add(featureRootMatch[1]);
  }

  if (isCatalogRootSourceFile(sourceFile) && sourceFile !== "src/features/catalog/index.ts") {
    failures.push(
      `Catalog source files must live in resource or shared packages.\n  - ${sourceFile}`,
    );
  }

  const source = fs.readFileSync(path.join(root, sourceFile), "utf8");
  for (const specifier of collectModuleSpecifiers(source)) {
    const targetFile = resolveRelativeImport(sourceFile, specifier);
    const importFailures = checkImport(sourceFile, specifier, targetFile);

    for (const failure of importFailures) {
      failures.push(`${failure}\n  - ${describeImport(sourceFile, specifier, targetFile)}`);
    }
  }
}

if (unknownFeatureRoots.size > 0) {
  failures.push(
    [
      "Top-level feature folders must be catalog, runtime, modes, navigation, or shell.",
      ...[...unknownFeatureRoots].sort().map((featureRoot) => `  - src/features/${featureRoot}`),
    ].join("\n"),
  );
}

if (failures.length > 0) {
  console.error("Frontend boundary check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Frontend boundary check passed for ${sourceFiles.length} source files.`);
