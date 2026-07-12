import type { NavPromptPresetFileImportResult } from "../../navigation";

function importStatus(result: NavPromptPresetFileImportResult): string {
  if (result.ok) {
    return `Imported ${result.preset.title}${result.sourceName ? ` from ${result.sourceName}` : ""}.${result.storageWarning ? ` ${result.storageWarning}` : ""}`;
  }
  return result.cancelled ? "Import cancelled." : `Import failed: ${result.error}`;
}

export function unexpectedPromptPresetFileErrorStatus(
  action: "Import" | "Export",
  error: unknown,
): string {
  return `${action} failed: ${error instanceof Error ? error.message : "Unexpected file error."}`;
}

interface RunPromptPresetImportInput {
  importFile: () => Promise<NavPromptPresetFileImportResult>;
  isOriginCurrent: () => boolean;
  onImportedPresetReady: (presetId: string) => void;
  onStatusChange: (status: string) => void;
}

export async function runPromptPresetImport({
  importFile,
  isOriginCurrent,
  onImportedPresetReady,
  onStatusChange,
}: RunPromptPresetImportInput) {
  onStatusChange("");
  try {
    const result = await importFile();
    onStatusChange(importStatus(result));
    if (result.ok && isOriginCurrent()) {
      onImportedPresetReady(result.preset.id);
    }
  } catch (error) {
    onStatusChange(unexpectedPromptPresetFileErrorStatus("Import", error));
  }
}
