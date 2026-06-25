import type { DeKoiStorageBundle } from "./dekoi-storage-bundle";
import {
  readDesktopStorageBundleSnapshot,
  writeDesktopStorageBundle as writeDesktopStorageBundlePayload,
} from "../../../shared/api/desktop-storage-bundle";
import { asDesktopHostErrorMessage } from "../../../shared/api/desktop-host-common";
import {
  normalizeDesktopStorageBundleSnapshot,
  type DeKoiDesktopStorageBundleInfo,
  type DeKoiDesktopStorageBundleResult,
  type DeKoiDesktopStorageBundleSnapshot,
} from "./desktop-storage-bundle-normalizer";

export type DeKoiDesktopStorageReadResult =
  | Extract<DeKoiDesktopStorageBundleResult, { ok: true }>
  | { ok: false; error: string };

export async function readDesktopStorageBundle(): Promise<DeKoiDesktopStorageReadResult> {
  let snapshot: DeKoiDesktopStorageBundleSnapshot | null;
  try {
    snapshot = await readDesktopStorageBundleSnapshot();
  } catch (error) {
    return { ok: false, error: asDesktopHostErrorMessage(error) };
  }

  if (!snapshot) {
    return { ok: false, error: "No desktop host bundle has been saved yet." };
  }

  return normalizeDesktopStorageBundleSnapshot(snapshot);
}

export async function writeDesktopStorageBundle(
  bundle: DeKoiStorageBundle,
): Promise<DeKoiDesktopStorageBundleInfo> {
  return await writeDesktopStorageBundlePayload(bundle);
}
