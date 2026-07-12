import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import { PromptPresetFileActions } from "./PromptPresetFileActions";
import { runPromptPresetImport } from "./prompt-preset-file-import";

function deferred<Result>() {
  let resolve!: (result: Result) => void;
  const promise = new Promise<Result>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const delayedImportResult = {
  ok: true as const,
  preset: { ...STARTER_PROMPT_PRESET, id: "prompt-preset-delayed", title: "Delayed Preset" },
  sourceName: "Delayed Preset.json",
  storageWarning: "Storage is unavailable; this imported preset exists only for this session.",
};

function renderFileActions({
  host,
  visibility,
  status = "",
  exportBlockedReason,
}: {
  host: "browser" | "desktop";
  visibility: "list" | "editor" | "status";
  status?: string;
  exportBlockedReason?: string;
}) {
  return renderToStaticMarkup(
    visibility === "list" ? (
      <PromptPresetFileActions
        host={host}
        visibility="list"
        importPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        openPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        exportPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        navigationContext={{ kind: "presets" }}
        originActive
        status={status}
        onImportedPresetReady={vi.fn()}
        onStatusChange={vi.fn()}
      />
    ) : visibility === "editor" ? (
      <PromptPresetFileActions
        host={host}
        visibility="editor"
        selectedPresetId="preset-selected"
        exportBlockedReason={exportBlockedReason}
        importPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        openPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        exportPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        navigationContext={{ kind: "presets", presetId: "preset-selected" }}
        originActive
        status={status}
        onImportedPresetReady={vi.fn()}
        onStatusChange={vi.fn()}
      />
    ) : (
      <PromptPresetFileActions
        host={host}
        visibility="status"
        importPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        openPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        exportPromptPresetFile={vi.fn(async () => ({ ok: false as const, error: "not used" }))}
        navigationContext={{ kind: "presets" }}
        originActive
        status={status}
        onImportedPresetReady={vi.fn()}
        onStatusChange={vi.fn()}
      />
    ),
  );
}

describe("PromptPresetFileActions", () => {
  it("opens a delayed import when its originating view remains current", async () => {
    const importResult = deferred<typeof delayedImportResult>();
    const onImportedPresetReady = vi.fn();
    const onStatusChange = vi.fn();

    const importPromise = runPromptPresetImport({
      importFile: () => importResult.promise,
      isOriginCurrent: () => true,
      onImportedPresetReady,
      onStatusChange,
    });
    importResult.resolve(delayedImportResult);
    await importPromise;

    expect(onImportedPresetReady).toHaveBeenCalledWith("prompt-preset-delayed");
    expect(onStatusChange).toHaveBeenLastCalledWith(
      "Imported Delayed Preset from Delayed Preset.json. Storage is unavailable; this imported preset exists only for this session.",
    );
  });

  it("reports a delayed import without opening it after the originating view changes", async () => {
    const importResult = deferred<typeof delayedImportResult>();
    let originCurrent = true;
    const onImportedPresetReady = vi.fn();
    const onStatusChange = vi.fn();

    const importPromise = runPromptPresetImport({
      importFile: () => importResult.promise,
      isOriginCurrent: () => originCurrent,
      onImportedPresetReady,
      onStatusChange,
    });
    originCurrent = false;
    importResult.resolve(delayedImportResult);
    await importPromise;

    expect(onImportedPresetReady).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      "Imported Delayed Preset from Delayed Preset.json. Storage is unavailable; this imported preset exists only for this session.",
    );
  });

  it("shows import but not export in the list", () => {
    const markup = renderFileActions({ host: "browser", visibility: "list" });

    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="application/json,.json,.marinara.json"');
    expect(markup).toContain("Import JSON");
    expect(markup).not.toContain("Export JSON");
  });

  it("shows export but not import in a saved editor", () => {
    const markup = renderFileActions({
      host: "desktop",
      visibility: "editor",
      status: "Export failed: disk full",
    });

    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain("Import JSON");
    expect(markup).toContain("Export JSON");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Full Pond bundles remain separate in Pond Care.");
  });

  it("keeps import status without rendering file actions", () => {
    const markup = renderFileActions({
      host: "browser",
      visibility: "status",
      status: "Imported Portable Proof from Portable Proof.json.",
    });

    expect(markup).toContain("Imported Portable Proof from Portable Proof.json.");
    expect(markup).not.toContain("Import JSON");
    expect(markup).not.toContain("Export JSON");
  });

  it("keeps export visible but disabled for an unsaved editor draft", () => {
    const markup = renderFileActions({
      host: "browser",
      visibility: "editor",
      exportBlockedReason: "Save changes before exporting this preset.",
    });

    expect(markup).toContain("Export JSON");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Save changes before exporting this preset.");
  });
});
