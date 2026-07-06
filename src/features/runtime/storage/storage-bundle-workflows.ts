export {
  createDeKoiStorageBundle,
  createDeKoiStorageBundleFingerprint,
  getDeKoiStorageBundleCounts,
  type DeKoiStorageBundle,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
} from "../../../runtime";
export {
  type DeKoiLegacyImportData,
  type DeKoiLegacyImportPreview,
  type DeKoiLegacyImportParseResult,
} from "../../../runtime";
import {
  exportDesktopBundleFile,
  importDesktopBundleFile,
  normalizeDeKoiStorageBundle,
  normalizeLegacyImport,
  readDesktopStorageBundle,
  writeDesktopStorageBundle,
  type AppStorageReplaceResult,
  type DeKoiStorageBundle,
  type DeKoiLegacyImportParseResult,
  type DeKoiStorageBundlePreview,
  type DeKoiStorageBundleParseResult,
} from "../../../runtime";

export type CareStorageImportCommitResult = AppStorageReplaceResult;
export type CareStorageBundlePreview = DeKoiStorageBundlePreview;

export async function saveCareDesktopStorageBundle(bundle: DeKoiStorageBundle) {
  return await writeDesktopStorageBundle(bundle);
}

export async function loadCareDesktopStorageBundle() {
  return await readDesktopStorageBundle();
}

export async function exportCareDesktopBundleFile(
  bundle: DeKoiStorageBundle,
  defaultFileName: string,
) {
  return await exportDesktopBundleFile(bundle, defaultFileName);
}

export async function importCareDesktopBundleFile() {
  return await importDesktopBundleFile();
}

export async function previewCareStorageBundleFile(
  file: File,
): Promise<DeKoiStorageBundleParseResult> {
  try {
    return normalizeDeKoiStorageBundle(JSON.parse(await file.text()) as unknown);
  } catch {
    return { ok: false, error: "Import file must be valid JSON." };
  }
}

export async function previewCareLegacyImportFile(
  file: File,
): Promise<DeKoiLegacyImportParseResult> {
  try {
    return normalizeLegacyImport(JSON.parse(await file.text()) as unknown);
  } catch {
    return { ok: false, error: "Legacy import file must be valid JSON." };
  }
}
