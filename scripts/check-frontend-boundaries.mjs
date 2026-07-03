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
const catalogResourcePackageNames = new Set(["companions", "lorebooks", "personas"]);
const shellPackageNames = new Set(["bank", "care", "pond", "shoal", "tide", "waterline"]);
const modePackageNames = new Set(["roleplay", "messenger"]);
const featureRuntimeOwnerPackageNames = new Set(["generation", "ripples", "storage"]);
const allowedFeatureRoots = new Set([...featureLayerRank.keys(), "navigation"]);

function isCatalogRootSourceFile(filePath) {
  return /^src\/features\/catalog\/[^/]+\.[jt]sx?$/.test(filePath);
}

function isFeatureEntryPoint(filePath) {
  return /^src\/features\/.+\/index\.[jt]sx?$/.test(filePath);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isUnder(filePath, directoryPath) {
  return filePath === directoryPath || filePath.startsWith(`${directoryPath}/`);
}

function getAppPackageRoot(filePath) {
  if (!isUnder(filePath, "src/app")) return null;
  return "src/app";
}

function getRuntimeBridgeRoot(filePath) {
  if (!isUnder(filePath, "src/runtime")) return null;
  return "src/runtime";
}

function isRuntimeRootSourceFile(filePath) {
  return /^src\/runtime\/[^/]+\.[jt]sx?$/.test(filePath);
}

function isFeatureRuntimeRootSourceFile(filePath) {
  return /^src\/features\/runtime\/[^/]+\.[jt]sx?$/.test(filePath);
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

function getCatalogRoot(filePath) {
  if (!isUnder(filePath, "src/features/catalog")) return null;
  return "src/features/catalog";
}

function getModesRoot(filePath) {
  if (!isUnder(filePath, "src/features/modes")) return null;
  return "src/features/modes";
}

function getShellPackageRoot(filePath) {
  const match = filePath.match(/^src\/features\/shell\/([^/]+)/);
  if (!match || !shellPackageNames.has(match[1])) return null;
  return `src/features/shell/${match[1]}`;
}

function getShellRoot(filePath) {
  if (!isUnder(filePath, "src/features/shell")) return null;
  return "src/features/shell";
}

function getModePackageRoot(filePath) {
  const match = filePath.match(/^src\/features\/modes\/([^/]+)/);
  if (!match || !modePackageNames.has(match[1])) return null;
  return `src/features/modes/${match[1]}`;
}

function getNavigationPackageRoot(filePath) {
  if (!isUnder(filePath, "src/features/navigation")) return null;
  return "src/features/navigation";
}

function isNavigationRootSourceFile(filePath) {
  return /^src\/features\/navigation\/[^/]+\.[jt]sx?$/.test(filePath);
}

function getFeatureRuntimePackageRoot(filePath) {
  if (!isUnder(filePath, "src/features/runtime")) return null;
  return "src/features/runtime";
}

function getFeatureRuntimeOwnerPackageName(filePath) {
  const match = filePath.match(/^src\/features\/runtime\/([^/]+)\//);
  return match?.[1] ?? null;
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

function resolveSourceImportTarget(sourceFile, specifier, sourceFileSet) {
  if (!specifier.startsWith(".")) return null;

  const absoluteTarget = path.resolve(root, path.dirname(sourceFile), specifier);
  const targetPath = toPosix(path.relative(root, absoluteTarget));
  const targetExtension = path.extname(targetPath);
  const candidates = [];

  if (sourceExtensions.has(targetExtension)) {
    candidates.push(targetPath);
  } else if (targetExtension === "") {
    for (const extension of sourceExtensions) {
      candidates.push(`${targetPath}${extension}`);
      candidates.push(`${targetPath}/index${extension}`);
    }
  }

  return candidates.find((candidate) => sourceFileSet.has(candidate)) ?? null;
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
  const sourceAppPackageRoot = getAppPackageRoot(sourceFile);
  const sourceFeatureLayer = getFeatureLayer(sourceFile);
  const sourceCatalogResourcePackageRoot = getCatalogResourcePackageRoot(sourceFile);

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
    failures.push(
      "Engine modules must not import app, runtime, feature, or shared frontend modules.",
    );
  }

  if (sourceIsApp && (isUnder(targetFile, "src/runtime") || isUnder(targetFile, "src/engine"))) {
    failures.push("App composition must not import runtime adapters or engine modules directly.");
  }

  if (sourceIsRuntime && (isUnder(targetFile, "src/app") || isUnder(targetFile, "src/features"))) {
    failures.push("Runtime adapters must not import app composition or React feature modules.");
  }

  if (sourceIsRuntime && targetFile === "src/shared/api/desktop-commands") {
    failures.push(
      "Runtime adapters must use shared API wrappers instead of the desktop command catalog.",
    );
  }

  if (
    targetFile === "src/runtime/storage/host-storage" &&
    sourceFile !== "src/runtime/storage/storage-repository-factory.ts"
  ) {
    failures.push("Host storage adapter imports must stay behind the storage repository factory.");
  }

  if (sourceIsShared && (isUnder(targetFile, "src/app") || isUnder(targetFile, "src/features"))) {
    failures.push("Shared modules must not import app composition or feature modules.");
  }

  if (sourceIsSharedApi && isUnder(targetFile, "src/runtime")) {
    failures.push("Shared API wrappers must not import runtime bridge modules.");
  }

  if (sourceIsNavigation && isUnder(targetFile, "src/shared/api")) {
    failures.push(
      "Navigation orchestration must route host and runtime API wrappers through features/runtime.",
    );
  }

  if (
    sourceIsGenericShared &&
    (isUnder(targetFile, "src/runtime") || isUnder(targetFile, "src/engine"))
  ) {
    failures.push("Generic shared helpers must not import runtime adapters or engine modules.");
  }

  const targetFeatureLayer = getFeatureLayer(targetFile);
  const targetAppPackageRoot = getAppPackageRoot(targetFile);
  const sourceRuntimeBridgeRoot = getRuntimeBridgeRoot(sourceFile);
  const targetRuntimeBridgeRoot = getRuntimeBridgeRoot(targetFile);
  const sourceCatalogRoot = getCatalogRoot(sourceFile);
  const targetCatalogRoot = getCatalogRoot(targetFile);
  const targetCatalogResourcePackageRoot = getCatalogResourcePackageRoot(targetFile);
  const sourceModesRoot = getModesRoot(sourceFile);
  const targetModesRoot = getModesRoot(targetFile);
  const sourceModePackageRoot = getModePackageRoot(sourceFile);
  const targetModePackageRoot = getModePackageRoot(targetFile);
  const sourceNavigationPackageRoot = getNavigationPackageRoot(sourceFile);
  const targetNavigationPackageRoot = getNavigationPackageRoot(targetFile);
  const sourceFeatureRuntimePackageRoot = getFeatureRuntimePackageRoot(sourceFile);
  const targetFeatureRuntimePackageRoot = getFeatureRuntimePackageRoot(targetFile);
  const sourceShellRoot = getShellRoot(sourceFile);
  const targetShellRoot = getShellRoot(targetFile);
  const sourceShellPackageRoot = getShellPackageRoot(sourceFile);
  const targetShellPackageRoot = getShellPackageRoot(targetFile);
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
    targetAppPackageRoot &&
    targetFile !== targetAppPackageRoot &&
    sourceAppPackageRoot !== targetAppPackageRoot
  ) {
    failures.push("App composition must be imported through its public entrypoint.");
  }

  if (
    targetRuntimeBridgeRoot &&
    targetFile !== targetRuntimeBridgeRoot &&
    sourceRuntimeBridgeRoot !== targetRuntimeBridgeRoot
  ) {
    failures.push("Runtime bridge modules must be imported through their public entrypoint.");
  }

  if (
    targetCatalogRoot &&
    targetFile !== targetCatalogRoot &&
    sourceCatalogRoot !== targetCatalogRoot
  ) {
    failures.push("Catalog must be imported through its public entrypoint.");
  }

  if (
    targetCatalogResourcePackageRoot &&
    targetFile !== targetCatalogResourcePackageRoot &&
    sourceCatalogResourcePackageRoot !== targetCatalogResourcePackageRoot
  ) {
    failures.push("Catalog resource packages must be imported through their public entrypoints.");
  }

  if (targetModesRoot && targetFile !== targetModesRoot && sourceModesRoot !== targetModesRoot) {
    failures.push("Modes must be imported through their public entrypoint.");
  }

  if (
    targetModePackageRoot &&
    targetFile !== targetModePackageRoot &&
    sourceModePackageRoot !== targetModePackageRoot
  ) {
    failures.push("Mode packages must be imported through their public entrypoints.");
  }

  if (
    targetNavigationPackageRoot &&
    targetFile !== targetNavigationPackageRoot &&
    sourceNavigationPackageRoot !== targetNavigationPackageRoot
  ) {
    failures.push("Navigation must be imported through its public entrypoint.");
  }

  if (
    targetFeatureRuntimePackageRoot &&
    targetFile !== targetFeatureRuntimePackageRoot &&
    sourceFeatureRuntimePackageRoot !== targetFeatureRuntimePackageRoot
  ) {
    failures.push("Feature runtime must be imported through its public entrypoint.");
  }

  if (targetShellRoot && targetFile !== targetShellRoot && sourceShellRoot !== targetShellRoot) {
    failures.push("Shell must be imported through its public entrypoint.");
  }

  if (
    targetShellPackageRoot &&
    targetFile !== targetShellPackageRoot &&
    sourceShellPackageRoot !== targetShellPackageRoot
  ) {
    failures.push("Shell packages must be imported through their public entrypoints.");
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
    failures.push(
      "Navigation orchestration must route runtime bridge imports through features/runtime.",
    );
  }

  if (
    sourceIsNonNavigationFeature &&
    sourceFeatureLayer !== "runtime" &&
    isUnder(targetFile, "src/runtime")
  ) {
    failures.push(
      "Shell, mode, and catalog features must route runtime bridge imports through features/runtime.",
    );
  }

  return failures;
}

function normalizeCycle(cycle) {
  const nodes = cycle.slice(0, -1);
  const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)]);
  const normalizedNodes = rotations
    .map((rotation) => [...rotation, rotation[0]])
    .sort((left, right) => left.join("\0").localeCompare(right.join("\0")))[0];
  return normalizedNodes.join(" -> ");
}

function findImportCycles(importGraph) {
  const state = new Map();
  const stack = [];
  const cycleKeys = new Set();
  const cycles = [];

  function visit(sourceFile) {
    state.set(sourceFile, "visiting");
    stack.push(sourceFile);

    for (const targetFile of importGraph.get(sourceFile) ?? []) {
      if (!importGraph.has(targetFile)) continue;

      const targetState = state.get(targetFile);
      if (targetState === "visiting") {
        const cycleStart = stack.indexOf(targetFile);
        const cycle = [...stack.slice(cycleStart), targetFile];
        const key = normalizeCycle(cycle);
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
        continue;
      }

      if (targetState !== "visited") {
        visit(targetFile);
      }
    }

    stack.pop();
    state.set(sourceFile, "visited");
  }

  for (const sourceFile of [...importGraph.keys()].sort()) {
    if (!state.has(sourceFile)) {
      visit(sourceFile);
    }
  }

  return cycles;
}

const sourceFiles = listSourceFiles(srcRoot).map((filePath) =>
  toPosix(path.relative(root, filePath)),
);
const sourceFileSet = new Set(sourceFiles);
const importGraph = new Map();
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

  if (isRuntimeRootSourceFile(sourceFile) && sourceFile !== "src/runtime/index.ts") {
    failures.push(`Runtime implementation files must live in owner packages.\n  - ${sourceFile}`);
  }

  if (
    isFeatureRuntimeRootSourceFile(sourceFile) &&
    sourceFile !== "src/features/runtime/index.ts"
  ) {
    failures.push(
      `Feature runtime implementation files must live in owner packages; only the entrypoint may stay at the feature-runtime root.\n  - ${sourceFile}`,
    );
  }

  const featureRuntimeOwnerPackageName = getFeatureRuntimeOwnerPackageName(sourceFile);
  if (
    featureRuntimeOwnerPackageName &&
    !featureRuntimeOwnerPackageNames.has(featureRuntimeOwnerPackageName)
  ) {
    failures.push(
      `Feature runtime owner packages must be generation, ripples, or storage.\n  - ${sourceFile}`,
    );
  }

  if (isNavigationRootSourceFile(sourceFile) && sourceFile !== "src/features/navigation/index.ts") {
    failures.push(
      `Navigation bridge implementation files must live in context; only the entrypoint may stay at the navigation root.\n  - ${sourceFile}`,
    );
  }

  if (
    isUnder(sourceFile, "src/features/navigation") &&
    sourceFile !== "src/features/navigation/index.ts" &&
    !isUnder(sourceFile, "src/features/navigation/context")
  ) {
    failures.push(
      `Navigation must only own context and nav contracts; move state, action, and runtime hooks to app or feature owners.\n  - ${sourceFile}`,
    );
  }

  const source = fs.readFileSync(path.join(root, sourceFile), "utf8");
  if (
    isUnder(sourceFile, "src/features") &&
    !isUnder(sourceFile, "src/features/navigation") &&
    /\bimport\s+\{\s*useNav\b[^}]*\}\s+from\s+["'][^"']*navigation["']/.test(source)
  ) {
    failures.push(
      `Feature modules must receive navigation state/actions through narrow feature-owned props instead of useNav().\n  - ${sourceFile}`,
    );
  }

  if (
    isUnder(sourceFile, "src/features") &&
    !isUnder(sourceFile, "src/features/navigation") &&
    /\bimport\s+(?:type\s+)?\{[^}]*\bNavContextType\b[^}]*\}\s+from\s+["'][^"']*navigation["']/.test(
      source,
    )
  ) {
    failures.push(
      `Feature modules must use navigation state/action groups instead of importing NavContextType.\n  - ${sourceFile}`,
    );
  }

  if (
    isUnder(sourceFile, "src/features") &&
    !isUnder(sourceFile, "src/features/navigation") &&
    /\bnav\s*:\s*NavContextType\b/.test(source)
  ) {
    failures.push(
      `Feature nav props must use narrow surface-owned contracts instead of NavContextType.\n  - ${sourceFile}`,
    );
  }

  if (
    isUnder(sourceFile, "src/features") &&
    !isUnder(sourceFile, "src/features/navigation") &&
    /\bPick\s*<\s*NavContextType\b/.test(source)
  ) {
    failures.push(
      `Feature nav props must use navigation state/action groups instead of Pick<NavContextType, ...>.\n  - ${sourceFile}`,
    );
  }

  if (isFeatureEntryPoint(sourceFile) && /\bexport\s+\*\s+from\b/.test(source)) {
    failures.push(`Feature package entrypoints must use explicit exports.\n  - ${sourceFile}`);
  }

  const specifiers = collectModuleSpecifiers(source);
  const sourceImportTargets = new Set();

  for (const specifier of specifiers) {
    const sourceImportTarget = resolveSourceImportTarget(sourceFile, specifier, sourceFileSet);
    if (sourceImportTarget) {
      sourceImportTargets.add(sourceImportTarget);
    }

    const targetFile = resolveRelativeImport(sourceFile, specifier);
    const importFailures = checkImport(sourceFile, specifier, targetFile);

    for (const failure of importFailures) {
      failures.push(`${failure}\n  - ${describeImport(sourceFile, specifier, targetFile)}`);
    }
  }

  importGraph.set(sourceFile, sourceImportTargets);
}

if (unknownFeatureRoots.size > 0) {
  failures.push(
    [
      "Top-level feature folders must be catalog, runtime, modes, navigation, or shell.",
      ...[...unknownFeatureRoots].sort().map((featureRoot) => `  - src/features/${featureRoot}`),
    ].join("\n"),
  );
}

const importCycles = findImportCycles(importGraph);
if (importCycles.length > 0) {
  failures.push(
    [
      "Circular source imports are not allowed.",
      ...importCycles.slice(0, 20).map((cycle) => `  - ${cycle.join(" -> ")}`),
      ...(importCycles.length > 20
        ? [`  - ...and ${importCycles.length - 20} more cycle(s).`]
        : []),
    ].join("\n"),
  );
}

if (failures.length > 0) {
  console.error("Frontend boundary check failed.");
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`Frontend boundary check passed for ${sourceFiles.length} source files.`);
