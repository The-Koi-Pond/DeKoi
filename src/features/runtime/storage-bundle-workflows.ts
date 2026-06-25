export {
  createDeKoiStorageBundle,
  getDeKoiStorageBundleCounts,
  type DeKoiStorageBundle,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
} from "../../runtime";
export {
  exportDesktopBundleFile,
  importDesktopBundleFile,
  type DeKoiDesktopBundleFileImportResult,
} from "../../runtime";
export {
  readDesktopStorageBundle,
  writeDesktopStorageBundle,
  type DeKoiDesktopStorageReadResult,
} from "../../runtime";
export {
  type DeKoiLegacyImportData,
  type DeKoiLegacyImportPreview,
  type DeKoiLegacyImportParseResult,
} from "../../runtime";
import {
  normalizeDeKoiStorageBundle,
  normalizeLegacyImport,
  type DeKoiLegacyImportParseResult,
  type DeKoiStorageBundleParseResult,
} from "../../runtime";

export async function previewDeKoiStorageBundleFile(
  file: File,
): Promise<DeKoiStorageBundleParseResult> {
  try {
    return normalizeDeKoiStorageBundle(JSON.parse(await file.text()) as unknown);
  } catch {
    return { ok: false, error: "Import file must be valid JSON." };
  }
}

export async function previewLegacyImportFile(
  file: File,
): Promise<DeKoiLegacyImportParseResult> {
  try {
    return normalizeLegacyImport(JSON.parse(await file.text()) as unknown);
  } catch {
    return { ok: false, error: "Legacy import file must be valid JSON." };
  }
}
