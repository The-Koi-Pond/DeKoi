import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import {
  downloadPromptPresetBrowserFile,
  getPromptPresetFileHost,
  readPromptPresetBrowserFile,
  readPromptPresetDesktopFile,
  writePromptPresetDesktopFile,
  type PromptPresetFileExportResult,
  type PromptPresetFileImportResult,
} from "../features/runtime";
import type { NavCatalogState, NavStorageActions } from "../features/navigation";
import { currentIsoTimestamp } from "../shared/browser/current-time";

type PromptPresetRecord = NavCatalogState["promptPresets"][number];

interface UsePromptPresetFileActionsInput {
  promptPresets: NavCatalogState["promptPresets"];
  prepareImportedPromptPreset: (record: PromptPresetRecord) => PromptPresetRecord;
  addImportedPromptPreset: (record: PromptPresetRecord) => PromptPresetRecord;
  savePromptPresetImport: SavePromptPresetImport;
  flushAppStorageSaves: NavStorageActions["flushAppStorageSaves"];
}

type SavePromptPresetImport = (
  preset: PromptPresetRecord,
) => Promise<{ saved: boolean; message: string }>;

interface CommitPromptPresetFileImportInput {
  result: PromptPresetFileImportResult;
  prepareImportedPromptPreset: (record: PromptPresetRecord) => PromptPresetRecord;
  addImportedPromptPreset: (record: PromptPresetRecord) => PromptPresetRecord;
  savePromptPresetImport: SavePromptPresetImport;
  flushAppStorageSaves: NavStorageActions["flushAppStorageSaves"];
  applyStateChange?: typeof flushSync;
}

function storageSaveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected storage save error.";
}

async function saveStagedPromptPreset(
  savePromptPresetImport: SavePromptPresetImport,
  preset: PromptPresetRecord,
) {
  try {
    const result = await savePromptPresetImport(preset);
    return { succeeded: result.saved, message: result.message };
  } catch (error) {
    return { succeeded: false, message: storageSaveErrorMessage(error) };
  }
}

export async function commitPromptPresetFileImport({
  result,
  prepareImportedPromptPreset,
  addImportedPromptPreset,
  savePromptPresetImport,
  flushAppStorageSaves,
  applyStateChange = flushSync,
}: CommitPromptPresetFileImportInput): Promise<PromptPresetFileImportResult> {
  if (!result.ok) return result;

  const preflight = await flushAppStorageSaves({ reason: "import" });
  const sessionOnly = preflight.mode === "unavailable" && !preflight.blocked;
  if (!sessionOnly && (preflight.status !== "ready" || !preflight.flushed)) {
    return {
      ok: false,
      error: `Import was not started because current changes could not be saved. ${preflight.message}`,
    };
  }

  const stagedPreset = prepareImportedPromptPreset(result.preset);

  if (sessionOnly) {
    const committedPreset = applyStateChange(() => addImportedPromptPreset(stagedPreset));
    return {
      ...result,
      preset: committedPreset,
      storageWarning: "Storage is unavailable; this imported preset exists only for this session.",
    };
  }

  const save = await saveStagedPromptPreset(savePromptPresetImport, stagedPreset);
  if (!save.succeeded) {
    return {
      ok: false,
      error: `Import failed while saving the new prompt preset. ${save.message}`,
    };
  }

  const committedPreset = applyStateChange(() => addImportedPromptPreset(stagedPreset));
  return { ...result, preset: committedPreset };
}

export function usePromptPresetFileActions({
  promptPresets,
  prepareImportedPromptPreset,
  addImportedPromptPreset,
  savePromptPresetImport,
  flushAppStorageSaves,
}: UsePromptPresetFileActionsInput) {
  const promptPresetFileHost = getPromptPresetFileHost();
  const [promptPresetFileStatus, setPromptPresetFileStatus] = useState("");

  const finishImport = useCallback(
    (result: PromptPresetFileImportResult): Promise<PromptPresetFileImportResult> => {
      return commitPromptPresetFileImport({
        result,
        prepareImportedPromptPreset,
        addImportedPromptPreset,
        savePromptPresetImport,
        flushAppStorageSaves,
      });
    },
    [
      addImportedPromptPreset,
      flushAppStorageSaves,
      prepareImportedPromptPreset,
      savePromptPresetImport,
    ],
  );

  const importPromptPresetFile = useCallback(
    async (file: File): Promise<PromptPresetFileImportResult> =>
      finishImport(await readPromptPresetBrowserFile(file)),
    [finishImport],
  );

  const openPromptPresetFile = useCallback(
    async (): Promise<PromptPresetFileImportResult> =>
      finishImport(await readPromptPresetDesktopFile()),
    [finishImport],
  );

  const exportPromptPresetFile = useCallback(
    async (presetId: string): Promise<PromptPresetFileExportResult> => {
      const preset = promptPresets.find((candidate) => candidate.id === presetId);
      if (!preset) {
        return { ok: false, error: "The selected prompt preset no longer exists." };
      }

      const exportedAt = currentIsoTimestamp();
      return promptPresetFileHost === "desktop"
        ? await writePromptPresetDesktopFile(preset, exportedAt)
        : downloadPromptPresetBrowserFile(preset, exportedAt);
    },
    [promptPresetFileHost, promptPresets],
  );

  return {
    promptPresetFileHost,
    promptPresetFileStatus,
    setPromptPresetFileStatus,
    importPromptPresetFile,
    openPromptPresetFile,
    exportPromptPresetFile,
  };
}
