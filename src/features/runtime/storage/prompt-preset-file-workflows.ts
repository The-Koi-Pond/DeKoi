import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { createPromptPresetFileExport, parsePromptPresetFileText } from "../../../runtime";
import {
  exportDesktopPromptPresetFile,
  importDesktopPromptPresetFile,
} from "../../../shared/api/desktop-prompt-preset-file";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { downloadJsonFile } from "../../../shared/browser/download-json";
import { errorMessage } from "../../../shared/errors";

type PromptPresetFileFailure =
  { ok: false; error: string; cancelled?: never } | { ok: false; cancelled: true; error: string };

export type PromptPresetFileImportResult =
  | {
      ok: true;
      preset: PromptPresetRecord;
      sourceName: string | null;
      storageWarning?: string;
    }
  | PromptPresetFileFailure;

export type PromptPresetFileExportResult =
  { ok: true; filename: string; path: string | null } | PromptPresetFileFailure;

interface PromptPresetBrowserFile {
  name: string;
  text(): Promise<string>;
}

const DESKTOP_PROMPT_PRESET_FILES_UNAVAILABLE =
  "Desktop prompt preset files are only available inside the Tauri app.";

export function getPromptPresetFileHost(): "browser" | "desktop" {
  return isDesktopHostAvailable() ? "desktop" : "browser";
}

function parsedPromptPresetResult(
  result: ReturnType<typeof parsePromptPresetFileText>,
  sourceName: string | null,
): PromptPresetFileImportResult {
  return result.ok ? { ...result, sourceName } : result;
}

function desktopPromptPresetFileFailure(action: string, error: unknown) {
  const message = errorMessage(error, DESKTOP_PROMPT_PRESET_FILES_UNAVAILABLE);
  return isDesktopHostAvailable() ? `Could not ${action} prompt preset file. ${message}` : message;
}

export async function readPromptPresetBrowserFile(
  file: PromptPresetBrowserFile,
): Promise<PromptPresetFileImportResult> {
  try {
    return parsedPromptPresetResult(parsePromptPresetFileText(await file.text()), file.name);
  } catch (error) {
    return { ok: false, error: `Could not read prompt preset file. ${errorMessage(error)}` };
  }
}

export function downloadPromptPresetBrowserFile(
  record: PromptPresetRecord,
  exportedAt: string,
): PromptPresetFileExportResult {
  const { filename, packageValue } = createPromptPresetFileExport(record, exportedAt);

  try {
    downloadJsonFile({ data: packageValue, filename });
    return { ok: true, filename, path: null };
  } catch (error) {
    return { ok: false, error: `Could not download prompt preset file. ${errorMessage(error)}` };
  }
}

export async function writePromptPresetDesktopFile(
  record: PromptPresetRecord,
  exportedAt: string,
): Promise<PromptPresetFileExportResult> {
  const { filename, packageValue } = createPromptPresetFileExport(record, exportedAt);

  try {
    const path = await exportDesktopPromptPresetFile(packageValue, filename);
    return path
      ? { ok: true, filename, path }
      : { ok: false, cancelled: true, error: "Prompt preset file export was cancelled." };
  } catch (error) {
    return { ok: false, error: desktopPromptPresetFileFailure("save", error) };
  }
}

export async function readPromptPresetDesktopFile(): Promise<PromptPresetFileImportResult> {
  try {
    const text = await importDesktopPromptPresetFile();
    return text === null
      ? { ok: false, cancelled: true, error: "Prompt preset file import was cancelled." }
      : parsedPromptPresetResult(parsePromptPresetFileText(text), null);
  } catch (error) {
    return { ok: false, error: desktopPromptPresetFileFailure("import", error) };
  }
}
